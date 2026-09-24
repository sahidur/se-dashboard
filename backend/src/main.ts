import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import type { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { FilesService } from './files/files.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  /**
   * Cheap session check for the uploads middleware: verifies the se360_at
   * cookie JWT (signature + expiry) without a DB round-trip. Deactivated
   * accounts are cut off within the access token's 15-minute TTL by the
   * regular guard pipeline on API calls.
   */
  const hasSessionJwt = (req: Request): boolean => {
    try {
      jwt.verify(req.cookies?.se360_at ?? '', process.env.JWT_SECRET || '', {
        algorithms: ['HS256'],
      });
      return true;
    } catch {
      return false;
    }
  };

  // Fail fast on weak/placeholder JWT signing secrets. Deploying with a
  // guessable secret lets anyone forge admin tokens, so refuse to start
  // rather than boot an exploitable app (redeploy.sh enforces the same rule).
  const jwtSecret = process.env.JWT_SECRET || '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  for (const [name, value] of [
    ['JWT_SECRET', jwtSecret],
    ['JWT_REFRESH_SECRET', refreshSecret],
  ] as const) {
    if (
      !value ||
      value.length < 32 ||
      /CHANGE_ME|change-in-production|placeholder/i.test(value)
    ) {
      logger.error(
        `${name} is missing, shorter than 32 chars, or a placeholder. ` +
          `Generate one with: openssl rand -hex 64`,
      );
      process.exit(1);
    }
  }

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

  // Required so the JWT strategy and auth controller can read the httpOnly
  // session cookies (se360_at / se360_rt). No signing key: cookies are verified
  // as JWTs, not as opaque signed values.
  app.use(cookieParser());

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

  // CORS — only allow the configured frontend origin(s).
  // CORS_ORIGIN accepts a single URL or a comma-separated list, so local dev
  // ports (e.g. 3000 and 3210) can be allow-listed together. In production
  // the fallback default (http://localhost:3000) must never silently apply —
  // an unset origin would either lock the API behind localhost or, worse,
  // advertise a plain-HTTP origin. Fail fast instead.
  const isProduction = process.env.APP_ENV === 'production';
  const corsOriginEnv = process.env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000');
  if (!corsOriginEnv) {
    logger.error(
      'CORS_ORIGIN is not set. In production the API refuses to start ' +
        'without an explicit https:// frontend origin list.',
    );
    process.exit(1);
  }
  const corsOrigins = corsOriginEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Plain-HTTP origins in production invite HTTPS→HTTP downgrade issues
  // (mixed content, cleartext credentialed CORS). Refuse them early.
  if (isProduction && corsOrigins.some((o) => o.startsWith('http://'))) {
    logger.error(
      `CORS_ORIGIN contains non-https origin(s) in production: ${corsOrigins.join(', ')}`,
    );
    process.exit(1);
  }
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
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
  //
  // Every request must carry a valid HMAC signature (see FilesService) OR an
  // authenticated session: upload URLs are rendered by the browser without
  // auth headers, so anonymous access requires a fresh signature, while
  // logged-in users (whose <img> requests carry the session cookie) can keep
  // using older stored URLs even after their signature expires. Unsigned
  // requests without a session are only accepted while
  // UPLOADS_ALLOW_UNSIGNED=true (legacy migration grace).
  const filesService = app.get(FilesService);
  app.use('/api/uploads', (req: Request, res: Response, next: NextFunction) => {
    // req.path inside a mounted router excludes the mount prefix.
    let key: string;
    try {
      key = decodeURIComponent(req.path.replace(/^\/+/, ''));
    } catch {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    const signatureValid = filesService.verifyLocalRequest(
      key,
      req.query['x-exp'],
      req.query['x-sig'],
    );
    if (!signatureValid && !hasSessionJwt(req)) {
      return res.status(403).json({ message: 'Invalid or expired file URL' });
    }
    next();
  });
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
      .setTitle('SE360 API')
      .setDescription('API documentation for SE360')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`API Docs: http://localhost:${port}/api/docs`);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // The production API is only reachable through the local nginx proxy.
  // Otherwise direct connections can spoof the trusted proxy hop and bypass
  // IP-based throttling, even if the host firewall is misconfigured.
  await app.listen(port, isProduction ? '127.0.0.1' : '0.0.0.0');
  logger.log(`Application running on port ${port} [${process.env.APP_ENV ?? 'development'}]`);
}
bootstrap();
