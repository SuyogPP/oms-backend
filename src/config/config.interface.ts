/**
 * Interface defining the shape of the application's configuration object.
 * This provides type safety when accessing configuration values via ConfigService.
 */
export interface AppConfig {
  /** The port on which the NestJS server listens */
  port: number;

  /** Database connection settings */
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };

  /** JWT configuration for authentication */
  jwt: {
    secret: string;
  };

  /** External service URLs */
  nextjs: {
    url: string;
  };
}
