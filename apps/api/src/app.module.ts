import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './core/auth/auth.module';
import { RequestContextMiddleware } from './core/context/request-context.middleware';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './health/health.module';
import { DepartmentModule } from './knowledge/department/department.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    RedisModule,
    AuthModule,
    DepartmentModule,
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
