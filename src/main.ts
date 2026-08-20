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

  // CORS Configuration
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000',
    ],
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
  await app.listen(port);

  console.log(`OMS Backend running on http://localhost:${port}/api/v1`);
  console.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

bootstrap();
