import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { SurveysModule } from './surveys/surveys.module';
import { FilesModule } from './files/files.module';
import { GeoLocationsModule } from './geo-locations/geo-locations.module';
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
        const dbSslRejectUnauthorized =
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED', 'false') ===
          'true';
        if (!dbPassword) {
          throw new Error('DB_PASSWORD environment variable is not set');
        }
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: dbPassword,
          database: configService.get<string>('DB_DATABASE', 'bep_se'),
          ssl: dbSslEnabled
            ? { rejectUnauthorized: dbSslRejectUnauthorized }
            : false,
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
