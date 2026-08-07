export const INGEST_QUEUE = Symbol('INGEST_QUEUE');

export const IMAGE_CLEANUP_QUEUE = Symbol('IMAGE_CLEANUP_QUEUE');

export type ImageCleanupJob = Record<string, never>;

/**
 * Job chạy ngoài request nên không có ngữ cảnh khách hàng để đọc — `tenantId` phải
 * đi kèm payload, và mọi truy vấn trong job đều mở qua `TenantDb.runAs`.
 */
export type IngestJob = {
  documentId: string;
  tenantId: string;
};
