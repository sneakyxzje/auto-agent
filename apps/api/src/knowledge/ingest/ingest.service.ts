import type { Readable } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { documents } from '../../db/schema/document';
import { TenantDb } from '../../db/tenant-db.service';
import { LlmService } from '../../llm/llm.service';
import { ObjectStorage } from '../../storage/object-storage.service';
import { PublishService } from '../publish/publish.service';
import { injectOcr, ocrEmbeddedImages } from './image-ocr';
import { cleanText, extractDocument, markHeadingLines } from './text-extract';

/** Dưới ngưỡng này thì gần như chắc chắn là PDF scan hoặc file hỏng. */
const MIN_TEXT_CHARS = 40;

const readAll = async (stream: Readable): Promise<Buffer> => {
  const parts: Buffer[] = [];
  for await (const part of stream) parts.push(Buffer.from(part));

  return Buffer.concat(parts);
};

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly storage: ObjectStorage,
    private readonly publish: PublishService,
    private readonly llm: LlmService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Bóc text → chia đoạn → tạo embedding → xuất bản. Chạy trong worker vì tạo
   * embedding cho một tài liệu 20 trang mất hàng chục giây, quá lâu cho một request.
   *
   * Gọi embedding NGOÀI transaction là cố ý: giữ transaction mở suốt thời gian chờ
   * nhà cung cấp trả lời sẽ giam kết nối và khoá dòng dữ liệu vô ích.
   */
  readonly run = async (
    documentId: string,
    tenantId: string,
  ): Promise<void> => {
    const document = await this.tenantDb.runAs(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: documents.id,
          departmentId: documents.departmentId,
          audience: documents.audience,
          effectiveTo: documents.effectiveTo,
          fileRef: documents.fileRef,
          fileName: documents.fileName,
          title: documents.title,
        })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      const found = rows[0];
      if (found === undefined) throw new Error('Tài liệu không còn tồn tại');

      const fileRef = found.fileRef;
      if (fileRef === null) throw new Error('Tài liệu không có file');

      await tx
        .update(documents)
        .set({
          ingestStatus: 'processing',
          ingestError: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      return { ...found, fileRef };
    });

    try {
      const buffer = await readAll(await this.storage.get(document.fileRef));
      const extracted = await extractDocument(
        buffer,
        document.fileName ?? 'tai-lieu',
      );
      const ocr = await ocrEmbeddedImages(
        this.llm,
        this.env.LLM_MODEL_VISION,
        extracted.images,
      );
      const text = cleanText(
        injectOcr(markHeadingLines(cleanText(extracted.text)), ocr),
      );

      if (text.length < MIN_TEXT_CHARS) {
        throw new Error(
          'Không bóc được text từ file. Tài liệu phải có sẵn text, bản scan chưa hỗ trợ.',
        );
      }

      // Từ đây trở đi đi chung đường với tri thức duyệt từ escalation.
      const chunkCount = await this.publish.index(documentId, text, tenantId);

      this.logger.log(
        `Đã ingest "${document.title}": ${chunkCount} đoạn, sẵn sàng trả lời`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      await this.tenantDb.runAs(tenantId, (tx) =>
        tx
          .update(documents)
          .set({
            ingestStatus: 'failed',
            ingestError: message,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, documentId)),
      );

      throw error;
    }
  };
}
