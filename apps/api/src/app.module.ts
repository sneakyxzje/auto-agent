import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './health/health.module';

/**
 * Bốn module nghiệp vụ sẽ thêm dần: core (user, department, JWT, rate limit),
 * knowledge (document, chunk, ingest, search, publish), chat (conversation,
 * orchestrator, SSE, ảnh), escalation (ticket, SLA, webhook, duyệt tri thức).
 *
 * Không có module `api/` riêng — controller nằm cùng module nghiệp vụ, còn tiền
 * tố /api/v1 đặt tập trung ở main.ts.
 */
@Module({
  imports: [ConfigModule, DrizzleModule, HealthModule],
})
export class AppModule {}
