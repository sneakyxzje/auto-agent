import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import {
  IMAGE_CLEANUP_QUEUE,
  type ImageCleanupJob,
  INGEST_QUEUE,
  type IngestJob,
} from './queue.tokens';

export * from './queue.tokens';

/**
 * BullMQ chiếm riêng kết nối Redis khi chờ job (blocking command), nên nó không
 * dùng chung client với rate limiter. `maxRetriesPerRequest: null` là bắt buộc:
 * thiếu thì worker tự chết khi Redis chớp mạng thay vì chờ kết nối lại.
 */
export const createQueueConnection = (env: Env): IORedis =>
  new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

@Global()
@Module({
  providers: [
    {
      provide: INGEST_QUEUE,
      useFactory: (env: Env): Queue<IngestJob> =>
        new Queue<IngestJob>('ingest', {
          connection: createQueueConnection(env),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        }),
      inject: [ENV],
    },
    {
      provide: IMAGE_CLEANUP_QUEUE,
      useFactory: (env: Env): Queue<ImageCleanupJob> =>
        new Queue<ImageCleanupJob>('image-cleanup', {
          connection: createQueueConnection(env),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: 20,
            removeOnFail: 100,
          },
        }),
      inject: [ENV],
    },
  ],
  exports: [INGEST_QUEUE, IMAGE_CLEANUP_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(INGEST_QUEUE) private readonly ingestQueue: Queue,
    @Inject(IMAGE_CLEANUP_QUEUE) private readonly imageCleanupQueue: Queue,
  ) {}

  onModuleDestroy = async (): Promise<void> => {
    await this.ingestQueue.close();
    await this.imageCleanupQueue.close();
  };
}
