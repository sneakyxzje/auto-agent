import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
// HealthService phải import dạng giá trị, không phải `import type` — Nest đọc
// metadata runtime của constructor để phân giải DI, đổi sang type-only là app
// chết lúc khởi động.
import { type HealthReport, HealthService } from './health.service';

/**
 * `/health` đứng ngoài tiền tố /api và ngoài versioning vì nó phục vụ healthcheck
 * của Docker và nginx, không phải người dùng.
 *
 * Handler dưới đây là method thường chứ không phải arrow property: decorator
 * `@Get()` đọc `descriptor.value`, mà property decorator thì không có descriptor.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthReport> {
    const report = await this.healthService.check();

    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }
}
