import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  checkHealth() {
    return {
      status: 'ok',
      message: 'Server is running!',
      timestamp: new Date().toISOString(),
    };
  }
}
