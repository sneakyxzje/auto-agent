import {
  Global,
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import {
  AUTH_DATABASE,
  DATABASE,
  type Database,
  PG_POOL,
} from './database.tokens';
import * as schema from './schema';
import { EMBEDDING_DIMENSIONS } from './schema/chunk';
import { TenantDb } from './tenant-db.service';

export * from './database.tokens';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (env: Env): Pool =>
        new Pool({ connectionString: env.DATABASE_URL, max: 10 }),
      inject: [ENV],
    },
    {
      provide: DATABASE,
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
      inject: [PG_POOL],
    },
    {
      provide: AUTH_DATABASE,
      useFactory: (env: Env): Database =>
        drizzle(new Pool({ connectionString: env.DATABASE_AUTH_URL, max: 4 }), {
          schema,
        }),
      inject: [ENV],
    },
    TenantDb,
  ],
  exports: [DATABASE, AUTH_DATABASE, PG_POOL, TenantDb],
})
export class DrizzleModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleModule.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit = async (): Promise<void> => {
    if (this.env.EMBEDDING_DIMENSIONS !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `EMBEDDING_DIMENSIONS lệch: .env = ${this.env.EMBEDDING_DIMENSIONS}, ` +
          `schema = ${EMBEDDING_DIMENSIONS}. Đổi số chiều đòi hỏi migrate cột vector ` +
          'và tính lại embedding cho toàn bộ kho — xem chú thích ở db/schema/chunk.ts.',
      );
    }

    const { rows } = await this.pool.query<{ extversion: string }>(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
    );
    const version = rows[0]?.extversion;

    if (version === undefined) {
      throw new Error(
        'Chưa cài extension `vector`. Kiểm tra docker/postgres/init.sql.',
      );
    }

    this.assertIterativeScanAvailable(version);
    this.logger.log(`Đã kết nối PostgreSQL, pgvector ${version}`);
  };

  // Dưới 0.8.0 không có hnsw.iterative_scan: HNSW chọn ứng viên trước rồi mới lọc
  // phân quyền, nên phòng ban ít tài liệu sẽ mất gần hết kết quả. Triệu chứng là
  // bot escalate oan, rất dễ chẩn đoán nhầm thành lỗi prompt.
  private readonly assertIterativeScanAvailable = (version: string): void => {
    const [major = 0, minor = 0] = version.split('.').map(Number);
    if (major === 0 && minor < 8) {
      this.logger.warn(
        `pgvector ${version} chưa có hnsw.iterative_scan (cần >= 0.8.0). ` +
          'Tìm kiếm có lọc phòng ban sẽ tụt recall. Nâng image postgres lên.',
      );
    }
  };

  onModuleDestroy = async (): Promise<void> => {
    await this.pool.end();
  };
}
