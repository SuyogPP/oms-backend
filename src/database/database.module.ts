import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * DatabaseModule handles the application's connection to the MSSQL database
 * using TypeORM. It dynamically loads configuration settings via ConfigService.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      // Factory function to dynamically create TypeORM options
      useFactory: (config: ConfigService) => ({
        type: 'mssql', // Using Microsoft SQL Server
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        autoLoadEntities: true, // Automatically loads entities registered in forFeature()
        synchronize: false, // Disable synchronize in production to prevent accidental schema resets
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true', // Set to true if connecting to Azure SQL
          trustServerCertificate: process.env.DB_TRUST_CERT !== 'false', // Enabled by default for self-signed certificates
        },
        extra: {
          connectionTimeout: 15000,
          requestTimeout: 30000,
          pool: {
            max: 10, // Limit pool size to prevent memory exhaustion in 512MB RAM containers
            min: 1,
            idleTimeoutMillis: 30000,
          },
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
