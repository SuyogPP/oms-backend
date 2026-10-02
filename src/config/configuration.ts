import { AppConfig } from './config.interface';

/**
 * Factory function that loads environment variables and maps them to the AppConfig interface.
 * Falls back to default values if environment variables are not provided.
 * @returns {AppConfig} The configuration object
 */
export default (): AppConfig => ({
  port: parseInt(process.env.PORT || '4000', 10),

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
  },

  auditDatabase: {
    host: process.env.AUDIT_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.AUDIT_DB_PORT || process.env.DB_PORT || '1433', 10),
    username: process.env.AUDIT_DB_USERNAME || process.env.DB_USERNAME || '',
    password: process.env.AUDIT_DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.AUDIT_DB_DATABASE || 'DIEZ-AUDIT-DB',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'secretKey',
  },

  nextjs: {
    url: process.env.NEXTJS_URL || 'http://localhost:3000',
  },
});
