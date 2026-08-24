import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Suppress the default NestJS startup logs that mention port/host info
    logger: process.env.APP_ENV === 'production'
      ? ['warn', 'error']
      : ['log', 'warn', 'error', 'debug'],
  });

  // Reverse-proxy awareness. Only enable when the app really sits behind a
  // trusted proxy (nginx): with `trust proxy` off, a spoofed X-Forwarded-For is
  // ignored; with it on but no proxy in front, anyone could forge their client
  // IP and evade the login rate limiter.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== 'false') {
    const hops = Number(trustProxy);
    app.set('trust proxy', Number.isFinite(hops) && hops > 0 ? hops : 1);
  }

  // Security headers (OWASP: A05 – Security Misconfiguration)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // needed for Swagger UI assets
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global serialization (respects @Exclude() decorators)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // CORS — only allow the configured frontend origin
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Serve locally-stored uploads (used when S3 credentials are not configured).
  // Mounted here instead of via ServeStaticModule: that module installs an
  // SPA-style `index.html` fallback, so a request for a missing upload replied
  // with `ENOENT: no such file or directory, stat '<abs path>/uploads/index.html'`
  // — a confusing 404 that also disclosed the server's filesystem layout.
  // A plain static mount simply falls through to Nest's own 404 handler.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/api/uploads',
    index: false,
    dotfiles: 'deny',
    // Uploads are user-supplied content served from the API origin. Even
    // though the upload allowlist only permits images/pdf/spreadsheets, these
    // headers make sure nothing here can execute in that origin.
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self'; sandbox",
      );
    },
  });

  const port = process.env.APP_PORT || 4000;

  // Swagger — only in non-production environments
  if (process.env.APP_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Social Enterprise Platform API')
      .setDescription('API documentation for BEP Social Enterprise Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`API Docs: http://localhost:${port}/api/docs`);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Application running on port ${port} [${process.env.APP_ENV ?? 'development'}]`);
}
bootstrap();
