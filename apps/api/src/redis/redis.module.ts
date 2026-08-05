import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { RateLimiter } from './rate-limiter.service';
import { REDIS } from './redis.tokens';

export * from './redis.tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (env: Env): Redis => new Redis(env.REDIS_URL),
      inject: [ENV],
    },
    RateLimiter,
  ],
  exports: [REDIS, RateLimiter],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy = async (): Promise<void> => {
    await this.redis.quit();
  };
}
