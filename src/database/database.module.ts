import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AUDIT_DB_CONNECTION } from './database.constants';

/** Shared MSSQL connection options factory (encryption + pool settings) */
const mssqlOptions = (encrypt: boolean) => ({
  options: {
    encrypt, // Required for Azure SQL
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  },
  extra: {
    connectionTimeout: 15000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000,
    },
  },
});

/**
 * DatabaseModule registers two TypeORM connections:
 *
 * 1. **Default connection** → DIEZ-BUILD-DB (primary OMS database).
 *    Used by all TypeORM repositories/entities via `TypeOrmModule.forFeature()`.
 *
 * 2. **AUDIT_DB_CONNECTION** → DIEZ-AUDIT-DB (dedicated audit database).
 *    Injected by name wherever cross-DB audit writes are needed.
 *    Exported so feature modules can import this module and use the DataSource.
 */
@Module({
  imports: [
    // ─── Primary OMS Database (DIEZ-BUILD-DB) ─────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mssql',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: false,
        ...mssqlOptions(process.env.DB_ENCRYPT === 'true'),
      }),
    }),

    // ─── Audit Database (DIEZ-AUDIT-DB) ───────────────────────────────────────
    TypeOrmModule.forRootAsync({
      name: AUDIT_DB_CONNECTION, // Named connection — injected as @InjectDataSource(AUDIT_DB_CONNECTION)
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mssql',
        host: config.get<string>('auditDatabase.host'),
        port: config.get<number>('auditDatabase.port'),
        username: config.get<string>('auditDatabase.username'),
        password: config.get<string>('auditDatabase.password'),
        database: config.get<string>('auditDatabase.database'),
        autoLoadEntities: false, // Audit DB has no TypeORM entities; raw SQL only
        synchronize: false,
        ...mssqlOptions(process.env.DB_ENCRYPT === 'true'),
      }),
    }),
  ],
})
export class DatabaseModule {}
