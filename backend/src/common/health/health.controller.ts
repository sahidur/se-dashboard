import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  // Unauthenticated by design: nginx/systemd/uptime probes poll this route.
  // With JwtAuthGuard now applied globally, it must be explicitly @Public().
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
