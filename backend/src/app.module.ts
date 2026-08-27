import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { SurveysModule } from './surveys/surveys.module';
import { FilesModule } from './files/files.module';
import { GeoLocationsModule } from './geo-locations/geo-locations.module';
import { UserDesignationsModule } from './user-designations/user-designations.module';
import { RecycleBinModule } from './recycle-bin/recycle-bin.module';
import { DataCollectionModule } from './data-collection/data-collection.module';
import { SchoolMonitoringModule } from './school-monitoring/school-monitoring.module';
import { AuditModule } from './common/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // NOTE: locally-stored uploads are served from `main.ts` via
    // `app.useStaticAssets()`, not ServeStaticModule — see the comment there.
    // Rate limiting: 100 req per 60 s globally (OWASP: A04 – Insecure Design)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbPassword = configService.get<string>('DB_PASSWORD');
        const dbSslEnabled = configService.get<string>('DB_SSL') === 'true';
        // Secure by default: TLS without certificate validation is still
        // MITM-able. Only opt out explicitly (DB_SSL_REJECT_UNAUTHORIZED=false)
        // for hosts that don't trust the managed-DB CA chain yet.
        const dbSslRejectUnauthorized =
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED', 'true') !==
          'false';
        if (!dbPassword) {
          throw new Error('DB_PASSWORD environment variable is not set');
        }

        // If DB_CA_CERT is set, read the CA certificate file and include it
        // in the TLS options. This is required for managed databases (e.g.
        // DigitalOcean) whose CA is not in the default Node.js trust store.
        let sslOptions: Record<string, any> = {
          rejectUnauthorized: dbSslRejectUnauthorized,
        };
        const caCertPath = configService.get<string>('DB_CA_CERT');
        if (caCertPath) {
          try {
            const caCert = readFileSync(resolve(caCertPath), 'utf-8');
            sslOptions.ca = caCert;
          } catch {
            // If the file cannot be read, fall back to the default trust store
            // (rejectUnauthorized=true will still enforce CA validation).
          }
        }

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: dbPassword,
          database: configService.get<string>('DB_DATABASE', 'bep_se'),
          ssl: dbSslEnabled ? sslOptions : false,
          schema: configService.get<string>('DB_SCHEMA', 'bep'),
          autoLoadEntities: true,
          // Auto-DDL only for local development databases. A dev machine with
          // APP_ENV=development pointed at a shared/managed database must
          // never alter its schema implicitly — use `npm run schema:sync`.
          synchronize:
            configService.get<string>('APP_ENV') === 'development' &&
            ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(
              configService.get<string>('DB_HOST', 'localhost'),
            ),
          logging: configService.get<string>('APP_ENV') === 'development',
        };
      },
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    SurveysModule,
    FilesModule,
    GeoLocationsModule,
    UserDesignationsModule,
    RecycleBinModule,
    DataCollectionModule,
    SchoolMonitoringModule,
    AuditModule,
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
