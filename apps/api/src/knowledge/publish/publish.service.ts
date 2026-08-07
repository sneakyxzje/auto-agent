import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import type { Transaction } from '../../db/database.tokens';
import { chunks } from '../../db/schema/chunk';
import { documents } from '../../db/schema/document';
import { TenantDb } from '../../db/tenant-db.service';
import { EmbeddingService } from '../../llm/embedding.service';
import { chunkText } from '../ingest/chunker';
import { normalizeForSearch } from '../search/normalize';

/** Chèn theo mẻ: một câu INSERT vài nghìn dòng vector là đủ để nghẽn kết nối. */
const INSERT_BATCH = 100;

export type PublishInput = {
  tenantId: string;
  departmentId: string;
  title: string;
  content: string;
  audience: 'internal' | 'public';
  effectiveTo: Date | null;
  sourceType: 'upload' | 'escalation';
  createdBy: string;
};

/**
 * Đường DUY NHẤT để một đoạn text trở thành tri thức bot dùng được.
 *
 * Brief cấm module escalation ghi thẳng vào knowledge: gom về một chỗ thì việc
 * tăng phiên bản, ghi `sourceType`, chia đoạn, tạo embedding và đồng bộ bản sao
 * xuống `chunks` chỉ có một bản cài đặt — không có đường nào lách qua để tạo ra
 * tài liệu thiếu chunk hay chunk lệch quyền đọc.
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly embedding: EmbeddingService,
  ) {}

  /** Tạo tài liệu mới từ text rồi xuất bản luôn. Dùng cho tri thức đã duyệt. */
  readonly publishText = async (input: PublishInput): Promise<string> => {
    const documentId = randomUUID();

    const version = await this.tenantDb.runAs(input.tenantId, async (tx) => {
      const nextVersion = await this.archivePrevious(
        tx,
        input.departmentId,
        input.title,
      );

      await tx.insert(documents).values({
        id: documentId,
        tenantId: input.tenantId,
        departmentId: input.departmentId,
        title: input.title,
        audience: input.audience,
        sourceType: input.sourceType,
        version: nextVersion,
        status: 'draft',
        effectiveTo: input.effectiveTo,
        ingestStatus: 'processing',
        uploadedBy: input.createdBy,
      });

      return nextVersion;
    });

    await this.index(documentId, input.content, input.tenantId);
    this.logger.log(`Đã xuất bản "${input.title}" (bản v${version})`);

    return documentId;
  };

  /**
   * Chia đoạn → embedding → ghi `chunks` → chuyển tài liệu sang `published`.
   *
   * Gọi embedding NGOÀI transaction là cố ý: giữ transaction mở suốt thời gian
   * chờ nhà cung cấp trả lời sẽ giam kết nối và khoá dòng dữ liệu vô ích.
   */
  readonly index = async (
    documentId: string,
    content: string,
    tenantId: string,
  ): Promise<number> => {
    const document = await this.tenantDb.runAs(tenantId, async (tx) => {
      const rows = await tx
        .select({
          departmentId: documents.departmentId,
          audience: documents.audience,
          effectiveTo: documents.effectiveTo,
        })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      const found = rows[0];
      if (found === undefined) throw new Error('Tài liệu không còn tồn tại');

      return found;
    });

    const pieces = chunkText(content);

    this.logger.log(`Đang tạo embedding cho ${pieces.length} đoạn...`);
    const embedStartedAt = Date.now();
    const vectors = await this.embedding.embed(
      pieces.map((piece) => piece.content),
    );
    this.logger.log(
      `Xong embedding ${pieces.length} đoạn sau ${Math.round((Date.now() - embedStartedAt) / 1000)}s`,
    );

    await this.tenantDb.runAs(tenantId, async (tx) => {
      await tx.delete(chunks).where(eq(chunks.documentId, documentId));

      for (let start = 0; start < pieces.length; start += INSERT_BATCH) {
        const batch = pieces.slice(start, start + INSERT_BATCH);

        await tx.insert(chunks).values(
          batch.map((piece, offset) => ({
            tenantId,
            documentId,
            ord: start + offset,
            content: piece.content,
            tokenCount: piece.tokenCount,
            embedding: vectors[start + offset] ?? [],
            contentNorm: normalizeForSearch(piece.content),
            departmentId: document.departmentId,
            audience: document.audience,
            docStatus: 'published' as const,
            effectiveTo: document.effectiveTo,
          })),
        );
      }

      await tx
        .update(documents)
        .set({
          status: 'published',
          ingestStatus: 'done',
          ingestError: null,
          chunkCount: pieces.length,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    });

    return pieces.length;
  };

  /** Cùng phòng, cùng tiêu đề thì bản cũ lùi về `archived` và version tăng lên. */
  private readonly archivePrevious = async (
    tx: Transaction,
    departmentId: string,
    title: string,
  ): Promise<number> => {
    const previous = await tx
      .update(documents)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(
        and(
          eq(documents.departmentId, departmentId),
          eq(documents.title, title),
          ne(documents.status, 'archived'),
        ),
      )
      .returning({ id: documents.id, version: documents.version });

    for (const document of previous) {
      await tx
        .update(chunks)
        .set({ docStatus: 'archived' })
        .where(eq(chunks.documentId, document.id));
    }

    const highest = previous.reduce(
      (max, document) => Math.max(max, document.version),
      0,
    );

    return highest + 1;
  };
}
