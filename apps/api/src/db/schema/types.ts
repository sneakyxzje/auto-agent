// Kiểu cho các cột jsonb. Để ở đây thay vì @chatbot/contracts để drizzle-kit đọc
// được schema mà không phải build package khác trước.

/**
 * Độ trễ từng bước của một lượt hỏi–đáp, mili-giây. Tách nhỏ thay vì một cột
 * `latency_ms` tổng, vì khi vỡ ngân sách 3 giây thì con số tổng không cho biết
 * bước nào chậm.
 */
export type LatencyBreakdown = {
  rewrite?: number;
  retrieve?: number;
  gate?: number;
  timeToFirstToken?: number;
  /** Bỏ trống khi cache ảnh trúng. */
  vision?: number;
  total: number;
};

/** Chi phí từng bước, USD. */
export type CostBreakdown = {
  rewrite?: number;
  gate?: number;
  generate?: number;
  vision?: number;
  embedding?: number;
  total: number;
};

/** Đoạn lấy được từ bước tìm kiếm, lưu để tra khi debug "sao bot tìm sai". */
export type RetrievedChunkRef = {
  chunkId: string;
  documentId: string;
  rrfScore: number;
  rank: number;
};

/** Đoạn tương tự, hiển thị cạnh ứng viên tri thức để Owner đối chiếu. */
export type SimilarChunkRef = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
  content: string;
};

/** Kết quả trích xuất ảnh, cache theo sha256 để không gọi lại model vision. */
export type ImageExtraction = {
  ocrText: string;
  caption: string;
  inferredQuestion: string | null;
};
