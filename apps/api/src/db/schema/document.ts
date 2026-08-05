import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { departments } from './department';
import {
  audienceEnum,
  documentSourceTypeEnum,
  documentStatusEnum,
  ingestStatusEnum,
} from './enums';
import { tenantIdColumn } from './tenant';

/**
 * Gỡ tài liệu hay lên phiên bản mới đều chuyển `status` sang `archived`, không xóa cứng.
 *
 * Sửa `audience`, `status` hay `effectiveTo` ở đây thì phải cập nhật bản sao bên
 * `chunks` — xem chú thích trong chunk.ts.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 512 }).notNull(),
    audience: audienceEnum('audience').notNull().default('internal'),
    sourceType: documentSourceTypeEnum('source_type')
      .notNull()
      .default('upload'),
    version: integer('version').notNull().default(1),
    status: documentStatusEnum('status').notNull().default('draft'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    /** sha256 file gốc, chặn upload trùng để khỏi sinh embedding lại. */
    fileSha256: varchar('file_sha256', { length: 64 }),
    /** Đường dẫn trong S3/MinIO. */
    fileRef: text('file_ref'),
    /** Tên file người dùng tải lên, chỉ để hiển thị và đặt tên lúc tải về. */
    fileName: varchar('file_name', { length: 512 }),
    fileSizeBytes: integer('file_size_bytes'),
    fileMimeType: varchar('file_mime_type', { length: 128 }),

    ingestStatus: ingestStatusEnum('ingest_status')
      .notNull()
      .default('pending'),
    /** Lý do hỏng, hiện thẳng cho Editor thay vì bắt đi đọc log. */
    ingestError: text('ingest_error'),
    chunkCount: integer('chunk_count').notNull().default(0),
    uploadedBy: varchar('uploaded_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('documents_department_status_idx').on(
      table.tenantId,
      table.departmentId,
      table.status,
    ),
    index('documents_sha256_idx').on(table.tenantId, table.fileSha256),
    // Cho báo cáo tài liệu sắp/đã hết hiệu lực.
    index('documents_effective_to_idx').on(table.tenantId, table.effectiveTo),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
