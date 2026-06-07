import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { SurveysModule } from './surveys/surveys.module';
import { SchoolsModule } from './schools/schools.module';
import { FilesModule } from './files/files.module';
import { GeoLocationsModule } from './geo-locations/geo-locations.module';
import { RecycleBinModule } from './recycle-bin/recycle-bin.module';
import { DataCollectionModule } from './data-collection/data-collection.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
          ssl: configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: true }
            : false,
          schema: configService.get<string>('DB_SCHEMA', 'bep'),
          autoLoadEntities: true,
          synchronize: configService.get<string>('APP_ENV') === 'development',
          logging: configService.get<string>('APP_ENV') === 'development',
        };
      },
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    SurveysModule,
    SchoolsModule,
    FilesModule,
    GeoLocationsModule,
    RecycleBinModule,
    DataCollectionModule,
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
