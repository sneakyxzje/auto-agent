import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './core/auth/auth.module';
import { RequestContextMiddleware } from './core/context/request-context.middleware';
import { TenantModule } from './core/tenant/tenant.module';
import { DrizzleModule } from './db/drizzle.module';
import { EscalationModule } from './escalation/escalation.module';
import { HealthModule } from './health/health.module';
import { ImageModule } from './image/image.module';
import { DepartmentModule } from './knowledge/department/department.module';
import { DocumentModule } from './knowledge/document/document.module';
import { IngestModule } from './knowledge/ingest/ingest.module';
import { SearchModule } from './knowledge/search/search.module';
import { LlmModule } from './llm/llm.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    RedisModule,
    StorageModule,
    QueueModule,
    LlmModule,
    AuthModule,
    TenantModule,
    DepartmentModule,
    DocumentModule,
    IngestModule,
    SearchModule,
    EscalationModule,
    ImageModule,
    ChatModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
