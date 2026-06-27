import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger/swagger.setup';

/**
 * Bootstraps the NestJS application.
 * This is the main entry point where the Nest application instance is created,
 * global middleware (like pipes and CORS) are configured, and the server is started.
 */
async function bootstrap() {
  // Create the Nest application instance using the root AppModule
  const app = await NestFactory.create(AppModule);

  // Retrieve the ConfigService to access environment variables
  const configService = app.get(ConfigService);

  // Set a global prefix for all API routes (e.g., http://localhost:4000/api)
  app.setGlobalPrefix('api');

  // Initialize Swagger UI for API documentation
  setupSwagger(app);

  // Enable global validation pipe to enforce DTO validation rules.
  // whitelist: true strips properties that do not have any decorators
  // transform: true automatically transforms payloads to be objects typed according to their DTO classes
  // forbidNonWhitelisted: true throws an error if non-whitelisted properties are present
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configure Cross-Origin Resource Sharing (CORS)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000',
    ],
    credentials: true,
  });

  // Start the server, listening on the configured PORT or falling back to 4000
  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`Server running on port ${port}`);
}

bootstrap();