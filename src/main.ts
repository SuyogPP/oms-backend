import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger/swagger.setup';

/**
 * Bootstraps the NestJS application.
 * All API routes are prefixed under /api/v1.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown hooks for cloud containers (SIGTERM/SIGINT)
  app.enableShutdownHooks();

  // Set global prefix to /api/v1
  app.setGlobalPrefix('api/v1');

  // Initialize Swagger UI documentation
  setupSwagger(app);

  // Global DTO Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const configService = app.get(ConfigService);
  const nextJsUrl = configService.get<string>('nextjs.url');
  const customCorsOrigin = process.env.CORS_ORIGIN;

  const allowedOrigins: (string | RegExp)[] = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000',
  ];

  if (nextJsUrl) {
    allowedOrigins.push(nextJsUrl);
  }
  if (customCorsOrigin) {
    if (customCorsOrigin.includes(',')) {
      allowedOrigins.push(...customCorsOrigin.split(',').map((o) => o.trim()));
    } else {
      allowedOrigins.push(customCorsOrigin.trim());
    }
  }
  // Allow all onrender.com subdomains in production
  allowedOrigins.push(/\.onrender\.com$/);

  // CORS Configuration
  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server, curl, mobile, or health check requests without origin
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed instanceof RegExp) return allowed.test(origin);
        return allowed === origin;
      });
      if (isAllowed || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin ${origin} not allowed`), false);
    },
    credentials: true,
    exposedHeaders: [
      'x-correlation-id',
      'x-response-time',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ],
  });

  const port = process.env.PORT || 4000;
  // Always bind to 0.0.0.0 for containerized / cloud hosting (Render, Docker, Railway, K8s)
  await app.listen(port, '0.0.0.0');

  console.log(`OMS Backend running on http://0.0.0.0:${port}/api/v1`);
  console.log(
    `Swagger documentation available at http://0.0.0.0:${port}/api/docs`,
  );
}

bootstrap();
