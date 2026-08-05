import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from './redis.tokens';

export type RateLimitRule = {
  key: string;
  limit: number;
  windowSeconds: number;
};

@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  readonly consume = async (rule: RateLimitRule): Promise<void> => {
    const redisKey = `rl:${rule.key}`;
    const [[, used], [, ttl]] = (await this.redis
      .multi()
      .incr(redisKey)
      .ttl(redisKey)
      .exec()) as [[Error | null, number], [Error | null, number]];

    if (ttl < 0) await this.redis.expire(redisKey, rule.windowSeconds);

    if (used > rule.limit) {
      throw new HttpException(
        {
          message: 'Bạn thử quá nhiều lần, vui lòng đợi rồi thử lại',
          retryAfterSeconds: ttl > 0 ? ttl : rule.windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  };

  readonly reset = async (key: string): Promise<void> => {
    await this.redis.del(`rl:${key}`);
  };
}
