import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type Queue, Worker } from 'bullmq';
import { inArray } from 'drizzle-orm';
import { Pool } from 'pg';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { imageAssets, messageAttachments } from '../db/schema/image';
import { TenantDb } from '../db/tenant-db.service';
import { createQueueConnection } from '../queue/queue.module';
import {
  IMAGE_CLEANUP_QUEUE,
  type ImageCleanupJob,
} from '../queue/queue.tokens';
import { ObjectStorage } from '../storage/object-storage.service';

const EVERY_DAY_MS = 24 * 60 * 60 * 1000;

type ExpiredRow = { id: string; tenant_id: string; storage_path: string };

@Injectable()
export class ImageCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageCleanupWorker.name);
  private worker: Worker<ImageCleanupJob> | null = null;

  constructor(
    @Inject(IMAGE_CLEANUP_QUEUE)
    private readonly queue: Queue<ImageCleanupJob>,
    @Inject(ENV) private readonly env: Env,
    private readonly tenantDb: TenantDb,
    private readonly storage: ObjectStorage,
  ) {}

  onModuleInit = async (): Promise<void> => {
    if (process.env.RUN_WORKER !== '1') return;

    await this.queue.upsertJobScheduler('image-cleanup-daily', {
      every: EVERY_DAY_MS,
    });

    this.worker = new Worker<ImageCleanupJob>(
      'image-cleanup',
      async () => {
        await this.sweep();
      },
      { connection: createQueueConnection(this.env), concurrency: 1 },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Dọn ảnh thất bại (job ${job?.id}): ${error.message}`);
    });
  };

  private readonly sweep = async (): Promise<void> => {
    const owner = new Pool({
      connectionString: this.env.DATABASE_MIGRATION_URL,
      max: 1,
    });

    try {
      const { rows } = await owner.query<ExpiredRow>(
        `SELECT id, tenant_id, storage_path
         FROM image_assets
         WHERE expires_at IS NOT NULL AND expires_at < now()`,
      );

      const byTenant = new Map<string, ExpiredRow[]>();
      for (const row of rows) {
        const list = byTenant.get(row.tenant_id) ?? [];
        list.push(row);
        byTenant.set(row.tenant_id, list);
      }

      let removed = 0;

      for (const [tenantId, assets] of byTenant) {
        const ids = assets.map((asset) => asset.id);

        await this.tenantDb.runAs(tenantId, async (tx) => {
          await tx
            .delete(messageAttachments)
            .where(inArray(messageAttachments.imageAssetId, ids));
          await tx.delete(imageAssets).where(inArray(imageAssets.id, ids));
        });

        for (const asset of assets) {
          await this.storage.remove(asset.storage_path).catch(() => undefined);
        }

        removed += ids.length;
      }

      if (removed > 0) this.logger.log(`Đã dọn ${removed} ảnh quá hạn`);
    } finally {
      await owner.end();
    }
  };

  onModuleDestroy = async (): Promise<void> => {
    await this.worker?.close();
  };
}
