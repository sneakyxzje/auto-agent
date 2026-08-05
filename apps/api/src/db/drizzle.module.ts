import {
  Global,
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import * as schema from './schema';
import { EMBEDDING_DIMENSIONS } from './schema/chunk';

export const PG_POOL = Symbol('PG_POOL');
export const DATABASE = Symbol('DATABASE');

/**
 * Kết nối riêng cho luồng đăng ký / đăng nhập, chạy bằng role `chatbot_auth`.
 * Role này chỉ chạm được hai bảng `users` và `tenants`, vì lúc đó chưa biết người
 * dùng thuộc khách hàng nào nên chưa đặt được ngữ cảnh tenant.
 *
 * Đừng dùng nó cho việc gì khác — mọi truy vấn qua đây đều không bị RLS chặn.
 */
export const AUTH_DATABASE = Symbol('AUTH_DATABASE');

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

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
  ],
  exports: [DATABASE, AUTH_DATABASE, PG_POOL],
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
