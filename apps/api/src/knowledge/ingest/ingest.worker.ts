import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { createQueueConnection } from '../../queue/queue.module';
import type { IngestJob } from '../../queue/queue.tokens';
import { IngestService } from './ingest.service';

/** Một tài liệu chiếm CPU rất ít, phần lớn thời gian là chờ nhà cung cấp embedding. */
const CONCURRENCY = 3;

/**
 * Chỉ tiến trình `main.worker.ts` mới bật consumer. API và worker dùng chung
 * AppModule, không có cờ này thì mỗi container API cũng thành một worker và cùng
 * tranh job — số job chạy song song sẽ nhân theo số bản API đang chạy.
 */
@Injectable()
export class IngestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestWorker.name);
  private worker: Worker<IngestJob> | null = null;

  constructor(
    private readonly ingest: IngestService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit = (): void => {
    if (process.env.RUN_WORKER !== '1') return;

    this.worker = new Worker<IngestJob>(
      'ingest',
      async (job) => {
        await this.ingest.run(job.data.documentId, job.data.tenantId);
      },
      {
        connection: createQueueConnection(this.env),
        concurrency: CONCURRENCY,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Ingest hỏng cho tài liệu ${job?.data.documentId ?? '?'}: ${error.message}`,
      );
    });

    this.logger.log('Worker ingest đã sẵn sàng nhận job');
  };

  onModuleDestroy = async (): Promise<void> => {
    await this.worker?.close();
  };
}
