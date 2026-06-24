import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';





import { setupSwagger } from './common/swagger/swagger.setup';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  setupSwagger(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT || 4000);

  console.log(`Server running on port ${process.env.PORT || 4000}`);
}

bootstrap();