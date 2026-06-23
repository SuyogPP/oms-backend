

import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';

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