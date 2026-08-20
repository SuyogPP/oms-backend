import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Initializes and configures Swagger UI for API documentation.
 * @param app The NestJS application instance
 */
export function setupSwagger(app: INestApplication): void {
  // Disable Swagger in production environments if needed
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_SWAGGER !== 'true'
  ) {
    return;
  }

  // Configure Swagger DocumentBuilder
  const config = new DocumentBuilder()
    .setTitle('DIEZ Outsource Management System (OMS) API')
    .setDescription(
      'Authoritative REST API for DIEZ OMS. All business logic, SQL access, RBAC enforcement, and workflow decisions live here.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT Access Token to authenticate requests',
      },
      'JWT',
    )
    .addServer('http://localhost:4000', 'Local development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Inject proxy simulation headers globally into all Swagger paths
  // This allows testers to simulate being a user with specific roles/permissions
  for (const path in document.paths) {
    for (const method in document.paths[path]) {
      const operation = document.paths[path][method];
      operation.parameters = operation.parameters || [];

      operation.parameters.push({
        name: 'x-correlation-id',
        in: 'header',
        description: 'Correlation ID for distributed tracing (UUIDv4)',
        required: false,
        schema: { type: 'string' },
      });

      operation.parameters.push({
        name: 'x-roles',
        in: 'header',
        description:
          'Proxy Simulation: User Roles (e.g. ["SYSTEM_ADMIN", "HR"])',
        required: false,
        schema: { type: 'string' },
      });

      operation.parameters.push({
        name: 'x-permissions',
        in: 'header',
        description:
          'Proxy Simulation: User Permissions (e.g. ["USER.MANAGE", "REQUISITION.VIEW"])',
        required: false,
        schema: { type: 'string' },
      });

      operation.parameters.push({
        name: 'x-scopes',
        in: 'header',
        description: 'Proxy Simulation: User Scopes (e.g. ["internal"])',
        required: false,
        schema: { type: 'string' },
      });

      operation.parameters.push({
        name: 'x-user-id',
        in: 'header',
        description: 'Proxy Simulation: User ID',
        required: false,
        schema: { type: 'string' },
      });
    }
  }

  // Setup the Swagger UI endpoint at /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keeps the JWT token even after page refresh
    },
  });
}
