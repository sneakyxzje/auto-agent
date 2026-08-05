import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { messages } from './message';
import { tenantIdColumn } from './tenant';
import type { ImageExtraction } from './types';

/**
 * Cache kết quả trích xuất theo sha256 nên gửi lại cùng một ảnh không tốn thêm
 * lần gọi model vision nào. Cố ý để ở CSDL chứ không phải Redis — nó phải sống
 * theo vòng đời của ảnh.
 */
export const imageAssets = pgTable(
  'image_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    /** Đường dẫn trong S3/MinIO — ảnh không lưu trong CSDL. */
    storagePath: text('storage_path').notNull(),
    mime: varchar('mime', { length: 64 }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),

    ocrText: text('ocr_text'),
    caption: text('caption'),
    extraction: jsonb('extraction').$type<ImageExtraction>(),

    uploadedBy: varchar('uploaded_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Job nền quét cột này để xóa ảnh chat quá 90 ngày. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    // Cache trích xuất không dùng chung giữa các khách hàng: biết công ty khác
    // từng gửi đúng tấm ảnh này cũng đã là rò rỉ.
    unique('image_assets_tenant_sha256_key').on(table.tenantId, table.sha256),
    // Job dọn ảnh hết hạn chạy cho mọi khách hàng.
    index('image_assets_expires_at_idx').on(table.expiresAt),
  ],
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    tenantId: tenantIdColumn(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    imageAssetId: uuid('image_asset_id')
      .notNull()
      .references(() => imageAssets.id, { onDelete: 'restrict' }),
    ord: integer('ord').notNull(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.imageAssetId] })],
);

export type ImageAsset = typeof imageAssets.$inferSelect;
export type MessageAttachment = typeof messageAttachments.$inferSelect;
