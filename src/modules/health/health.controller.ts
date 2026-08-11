import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorators/public.decorator';

/**
 * HealthController provides endpoints to verify the status of the API.
 * These endpoints are typically used by load balancers or monitoring tools.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
    /**
     * Retrieves the health status of the application.
     * This endpoint is public and does not require JWT authentication.
     * @returns Status object indicating the API is running
     */
    @Public()
    @Get()
    getHealth() {
        return {
            success: true,
            message: 'API is running',
            timestamp: new Date(),
        };
    }
}