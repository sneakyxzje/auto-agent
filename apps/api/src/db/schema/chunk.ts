import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { departments } from './department';
import { documents } from './document';
import { audienceEnum, documentStatusEnum } from './enums';
import { tenantIdColumn } from './tenant';

// Khớp BAAI/bge-m3. Đổi số này là phải migrate cột vector và tính lại embedding
// cho toàn bộ kho — pgvector cố định số chiều theo cột. Chọn model embedding theo
// đích đến cuối cùng ngay từ đầu, đừng tính đổi sau.
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Bốn cột departmentId/audience/docStatus/effectiveTo là bản sao từ `documents`,
 * để WHERE phân quyền chạy gọn trên một bảng.
 *
 * Đổi lại: sửa các trường đó ở `documents` thì PHẢI cập nhật hết chunk của nó.
 * Quên là tài liệu vừa chuyển sang internal vẫn để khách ngoài đọc được.
 */
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ord: integer('ord').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull(),
    embedding: vector('embedding', {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    /** unaccent(lower(content)), tính lúc ingest — dùng cho tìm kiếm trigram. */
    contentNorm: text('content_norm').notNull(),

    // Bản sao từ `documents`, xem chú thích trên.
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    audience: audienceEnum('audience').notNull(),
    docStatus: documentStatusEnum('doc_status').notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('chunks_document_ord_key').on(table.documentId, table.ord),
    // Thứ tự cột phải khớp với scopeFilter(), tenant_id luôn đứng đầu.
    index('chunks_scope_idx').on(
      table.tenantId,
      table.departmentId,
      table.audience,
      table.docStatus,
    ),
    // Index vector không nhét tenant_id vào được, nên việc lọc theo khách hàng đè
    // hoàn toàn lên mệnh đề WHERE. Bắt buộc bật hnsw.iterative_scan khi truy vấn,
    // không thì một khách ít tài liệu sẽ bị lọc sạch ứng viên.
    index('chunks_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    index('chunks_content_norm_idx').using(
      'gin',
      table.contentNorm.op('gin_trgm_ops'),
    ),
  ],
);

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
