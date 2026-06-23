

import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')

export class HealthController {

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