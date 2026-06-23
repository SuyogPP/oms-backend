import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Enterprise API')
    .setDescription('Enterprise Management System API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT Access Token',
      },
      'JWT',
    )
    .addServer('http://localhost:4000/', 'Local environment')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Inject proxy simulation headers globally into Swagger
  for (const path in document.paths) {
    for (const method in document.paths[path]) {
      const operation = document.paths[path][method];
      operation.parameters = operation.parameters || [];

      operation.parameters.push({
        name: 'x-roles',
        in: 'header',
        description: 'Proxy Simulation: User Roles (e.g. ["Admin", "Manager"])',
        required: false,
        schema: { type: 'string' }
      });

      operation.parameters.push({
        name: 'x-permissions',
        in: 'header',
        description: 'Proxy Simulation: User Permissions (e.g. ["user.read", "user.write"])',
        required: false,
        schema: { type: 'string' }
      });

      operation.parameters.push({
        name: 'x-scopes',
        in: 'header',
        description: 'Proxy Simulation: User Scopes (e.g. ["internal"])',
        required: false,
        schema: { type: 'string' }
      });

      operation.parameters.push({
        name: 'x-user-id',
        in: 'header',
        description: 'Proxy Simulation: User ID',
        required: false,
        schema: { type: 'string' }
      });
    }
  }

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
