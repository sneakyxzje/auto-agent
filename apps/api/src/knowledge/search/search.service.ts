import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { TenantDb } from '../../db/tenant-db.service';
import { EmbeddingService } from '../../llm/embedding.service';
import { normalizeForSearch } from './normalize';
import { chunkScopeSql, type SearchScope } from './scope';

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  departmentId: string;
  departmentSlug: string;
  departmentName: string;
  content: string;
  score: number;
  rank: number;
};

type SearchRow = {
  id: string;
  document_id: string;
  document_title: string;
  department_id: string;
  department_slug: string;
  department_name: string;
  content: string;
  score: string;
};

/**
 * Hằng số RRF chuẩn. Nó làm phẳng chênh lệch giữa hai bảng xếp hạng, nhờ đó một
 * đoạn đứng hạng 3 cả hai bên thắng đoạn đứng hạng 1 ở một bên và mất hút ở bên kia.
 */
const RRF_K = 60;

/** Ngưỡng vào vòng ứng viên của nhánh từ khóa, xem chú thích ở chỗ set_config. */
const KEYWORD_THRESHOLD = '0.25';

@Injectable()
export class SearchService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * Tìm kiếm lai: vector cho ý nghĩa, trigram cho từ khóa và tên riêng, hợp nhất
   * bằng RRF. Chỉ một câu SQL để không phải kéo hai tập kết quả về Node rồi trộn
   * tay — và quan trọng hơn, để mệnh đề phân quyền chỉ viết một lần cho cả hai nhánh.
   */
  readonly search = async (
    query: string,
    scope: SearchScope,
    limits: { topK: number; minScore: number },
  ): Promise<RetrievedChunk[]> => {
    const vector = await this.embedding.embedOne(query);
    const vectorLiteral = `[${vector.join(',')}]`;
    const normalized = normalizeForSearch(query);

    return this.tenantDb.run(async (tx) => {
      /**
       * Không có iterative_scan thì HNSW chọn ứng viên TRƯỚC khi lọc phân quyền:
       * phòng ban ít tài liệu sẽ bị lọc sạch và bot escalate oan. Triệu chứng rất
       * dễ bị chẩn đoán nhầm thành lỗi prompt.
       */
      await tx.execute(
        sql`SELECT set_config('hnsw.iterative_scan', 'strict_order', true)`,
      );

      /**
       * Toán tử `<%` lọc theo `pg_trgm.word_similarity_threshold`, mặc định 0.6 —
       * nghĩa là 60% trigram của câu hỏi phải khớp trong một cửa sổ theo ranh giới
       * từ. Một câu hỏi cả chục chữ gần như không bao giờ đạt ngưỡng đó với đoạn
       * tài liệu dài, nên để mặc định là nhánh từ khóa trả về rỗng gần như mọi lần
       * và RRF thoái hóa thành tìm kiếm vector thuần — mất hẳn nửa cơ chế.
       *
       * Hạ ngưỡng chỉ nới tập ứng viên, không quyết định thứ hạng: xếp hạng vẫn do
       * `word_similarity` và RRF lo.
       */
      await tx.execute(
        sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${KEYWORD_THRESHOLD}, true)`,
      );

      const vectorScope = chunkScopeSql('c', scope);
      const keywordScope = chunkScopeSql('c', scope);

      const result = await tx.execute<SearchRow>(sql`
        WITH vec AS (
          SELECT c.id,
                 ROW_NUMBER() OVER (ORDER BY c.embedding <=> ${vectorLiteral}::vector) AS rank
          FROM chunks c
          WHERE ${vectorScope}
          ORDER BY c.embedding <=> ${vectorLiteral}::vector
          LIMIT ${limits.topK}
        ),
        kw AS (
          SELECT c.id,
                 ROW_NUMBER() OVER (ORDER BY word_similarity(${normalized}, c.content_norm) DESC) AS rank
          FROM chunks c
          WHERE ${keywordScope} AND ${normalized} <% c.content_norm
          ORDER BY word_similarity(${normalized}, c.content_norm) DESC
          LIMIT ${limits.topK}
        ),
        fused AS (
          SELECT COALESCE(vec.id, kw.id) AS id,
                 COALESCE(1.0 / (${RRF_K} + vec.rank), 0)
                   + COALESCE(1.0 / (${RRF_K} + kw.rank), 0) AS score
          FROM vec
          FULL OUTER JOIN kw ON kw.id = vec.id
        )
        SELECT c.id,
               c.document_id,
               c.department_id,
               c.content,
               d.title AS document_title,
               dep.slug AS department_slug,
               dep.name AS department_name,
               f.score
        FROM fused f
        JOIN chunks c ON c.id = f.id
        JOIN documents d ON d.id = c.document_id
        JOIN departments dep ON dep.id = c.department_id
        WHERE f.score >= ${limits.minScore}
        ORDER BY f.score DESC
        LIMIT ${limits.topK}
      `);

      return result.rows.map((row, index) => ({
        chunkId: row.id,
        documentId: row.document_id,
        documentTitle: row.document_title,
        departmentId: row.department_id,
        departmentSlug: row.department_slug,
        departmentName: row.department_name,
        content: row.content,
        score: Number(row.score),
        rank: index + 1,
      }));
    });
  };
}
