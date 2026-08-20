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
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        autoLoadEntities: true, // Automatically loads entities registered in forFeature()
        synchronize: false, // Disable synchronize in production to prevent accidental schema resets
        options: {
          encrypt: false, // Set to true if connecting to Azure SQL
          trustServerCertificate: true, // Useful for local development with self-signed certificates
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
