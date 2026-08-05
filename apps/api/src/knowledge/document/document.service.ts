import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  type UpdateDocumentInput,
  type UploadDocumentInput,
} from '@chatbot/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { Transaction } from '../../db/database.tokens';
import { chunks } from '../../db/schema/chunk';
import { departments } from '../../db/schema/department';
import { documents } from '../../db/schema/document';
import { TenantDb } from '../../db/tenant-db.service';
import { INGEST_QUEUE, type IngestJob } from '../../queue/queue.tokens';
import { ObjectStorage } from '../../storage/object-storage.service';

export type UploadedFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

export type DocumentSummary = {
  id: string;
  departmentId: string;
  departmentName: string;
  title: string;
  audience: 'internal' | 'public';
  status: 'draft' | 'published' | 'archived';
  ingestStatus: 'pending' | 'processing' | 'done' | 'failed';
  ingestError: string | null;
  chunkCount: number;
  version: number;
  fileName: string | null;
  fileSize: number | null;
  effectiveTo: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

const SUMMARY_COLUMNS = {
  id: documents.id,
  departmentId: documents.departmentId,
  departmentName: departments.name,
  title: documents.title,
  audience: documents.audience,
  status: documents.status,
  ingestStatus: documents.ingestStatus,
  ingestError: documents.ingestError,
  chunkCount: documents.chunkCount,
  version: documents.version,
  fileName: documents.fileName,
  fileSize: documents.fileSizeBytes,
  effectiveTo: documents.effectiveTo,
  uploadedBy: documents.uploadedBy,
  createdAt: documents.createdAt,
};

const extensionOf = (fileName: string): string =>
  fileName.split('.').pop()?.toLowerCase() ?? '';

const isSupported = (fileName: string): boolean =>
  (DOCUMENT_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));

const sha256Of = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

const toIsoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

@Injectable()
export class DocumentService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly storage: ObjectStorage,
    @Inject(INGEST_QUEUE) private readonly ingestQueue: Queue<IngestJob>,
  ) {}

  readonly list = async (
    departmentId: string | null,
  ): Promise<DocumentSummary[]> =>
    this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select(SUMMARY_COLUMNS)
        .from(documents)
        .innerJoin(departments, eq(departments.id, documents.departmentId))
        .where(
          departmentId === null
            ? undefined
            : eq(documents.departmentId, departmentId),
        )
        .orderBy(desc(documents.createdAt));

      return rows.map((row) => ({
        ...row,
        effectiveTo: toIsoOrNull(row.effectiveTo),
        createdAt: row.createdAt.toISOString(),
      }));
    });

  /**
   * Tải lên chưa sinh đoạn và embedding, nên tài liệu dừng ở `draft`: bot chưa
   * dùng nó để trả lời. Bước ingest của B1 sẽ nhận đúng bản ghi này rồi chuyển
   * sang `published`.
   *
   * Tải lại đúng file cũ bị chặn bằng sha256 — mục đích là không trả tiền tạo
   * embedding hai lần cho cùng nội dung.
   */
  readonly upload = async (
    file: UploadedFile,
    input: UploadDocumentInput,
    uploadedBy: string,
  ): Promise<DocumentSummary> => {
    if (!isSupported(file.fileName)) {
      throw new BadRequestException(
        `Chỉ nhận file ${DOCUMENT_EXTENSIONS.join(', ')} — tài liệu phải có sẵn text`,
      );
    }

    if (file.buffer.length === 0) {
      throw new BadRequestException('File rỗng');
    }

    if (file.buffer.length > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException('File vượt quá 50MB');
    }

    const sha256 = sha256Of(file.buffer);
    const documentId = randomUUID();

    const created = await this.tenantDb.run(async (tx, tenantId) => {
      await this.assertDepartmentExists(tx, input.departmentId);
      await this.assertNotDuplicate(tx, sha256);

      const version = await this.archivePreviousVersions(
        tx,
        input.departmentId,
        input.title,
      );

      const fileRef = `${tenantId}/documents/${documentId}/${encodeURIComponent(file.fileName)}`;
      await this.storage.put(fileRef, file.buffer, file.mimeType);

      try {
        const created = await tx
          .insert(documents)
          .values({
            id: documentId,
            tenantId,
            departmentId: input.departmentId,
            title: input.title,
            audience: input.audience,
            sourceType: 'upload',
            version,
            status: 'draft',
            effectiveTo:
              input.effectiveTo === null || input.effectiveTo === undefined
                ? null
                : new Date(input.effectiveTo),
            fileSha256: sha256,
            fileRef,
            fileName: file.fileName,
            fileSizeBytes: file.buffer.length,
            fileMimeType: file.mimeType,
            uploadedBy,
          })
          .returning({ id: documents.id });

        if (created[0] === undefined) {
          throw new Error('Không lưu được tài liệu');
        }
      } catch (error) {
        await this.storage.remove(fileRef).catch(() => undefined);
        throw error;
      }

      return { summary: await this.findOne(tx, documentId), tenantId };
    });

    // Đẩy job SAU khi transaction đã commit: worker chạy ở tiến trình khác, đẩy
    // sớm là nó đọc phải bản ghi chưa tồn tại.
    await this.enqueueIngest(documentId, created.tenantId);

    return created.summary;
  };

  /** Ingest hỏng vì file lỗi hay nhà cung cấp embedding chập chờn thì chạy lại. */
  readonly reingest = async (id: string): Promise<DocumentSummary> => {
    const target = await this.tenantDb.run(async (tx, tenantId) => {
      const updated = await tx
        .update(documents)
        .set({
          ingestStatus: 'pending',
          ingestError: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id))
        .returning({ id: documents.id });

      if (updated[0] === undefined) {
        throw new NotFoundException('Không tìm thấy tài liệu');
      }

      return { summary: await this.findOne(tx, id), tenantId };
    });

    await this.enqueueIngest(id, target.tenantId);

    return target.summary;
  };

  private readonly enqueueIngest = async (
    documentId: string,
    tenantId: string,
  ): Promise<void> => {
    // Dấu `:` là ký tự phân tách key của Redis nên BullMQ cấm dùng trong job id.
    // Kèm mốc thời gian để lần xử lý lại không bị coi là job trùng và bị bỏ qua.
    await this.ingestQueue.add(
      'ingest-document',
      { documentId, tenantId },
      { jobId: `${documentId}-${Date.now()}` },
    );
  };

  /**
   * `chunks` giữ bản sao của `audience`, `status` và `effectiveTo`. Cập nhật tài
   * liệu mà bỏ quên bản sao đó là để nguyên quyền đọc cũ — đúng đường rò tài liệu
   * nội bộ mà brief cảnh báo. Vì vậy hai lệnh update nằm chung một transaction.
   */
  readonly update = async (
    id: string,
    input: UpdateDocumentInput,
  ): Promise<DocumentSummary> =>
    this.tenantDb.run(async (tx) => {
      const effectiveTo =
        input.effectiveTo === undefined
          ? undefined
          : input.effectiveTo === null
            ? null
            : new Date(input.effectiveTo);

      const updated = await tx
        .update(documents)
        .set({
          ...(input.audience === undefined ? {} : { audience: input.audience }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(effectiveTo === undefined ? {} : { effectiveTo }),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id))
        .returning({ id: documents.id });

      if (updated[0] === undefined) {
        throw new NotFoundException('Không tìm thấy tài liệu');
      }

      await tx
        .update(chunks)
        .set({
          ...(input.audience === undefined ? {} : { audience: input.audience }),
          ...(input.status === undefined ? {} : { docStatus: input.status }),
          ...(effectiveTo === undefined ? {} : { effectiveTo }),
        })
        .where(eq(chunks.documentId, id));

      return this.findOne(tx, id);
    });

  readonly archive = async (id: string): Promise<DocumentSummary> =>
    this.update(id, { status: 'archived' });

  readonly openFile = async (
    id: string,
  ): Promise<{ stream: Readable; fileName: string; mimeType: string }> => {
    const found = await this.tenantDb.run(async (tx) =>
      tx
        .select({
          fileRef: documents.fileRef,
          fileName: documents.fileName,
          fileMimeType: documents.fileMimeType,
        })
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1),
    );

    const document = found[0];
    if (document === undefined || document.fileRef === null) {
      throw new NotFoundException('Không tìm thấy file của tài liệu này');
    }

    return {
      stream: await this.storage.get(document.fileRef),
      fileName: document.fileName ?? 'tai-lieu',
      mimeType: document.fileMimeType ?? 'application/octet-stream',
    };
  };

  private readonly assertDepartmentExists = async (
    tx: Transaction,
    departmentId: string,
  ): Promise<void> => {
    const found = await tx
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (found[0] === undefined) {
      throw new BadRequestException({
        message: 'Phòng ban không tồn tại',
        errors: [{ field: 'departmentId', message: 'Hãy chọn một phòng ban' }],
      });
    }
  };

  private readonly assertNotDuplicate = async (
    tx: Transaction,
    sha256: string,
  ): Promise<void> => {
    const found = await tx
      .select({ title: documents.title })
      .from(documents)
      .where(
        and(eq(documents.fileSha256, sha256), ne(documents.status, 'archived')),
      )
      .limit(1);

    const duplicate = found[0];
    if (duplicate !== undefined) {
      throw new ConflictException(
        `File này đã có trong kho với tên "${duplicate.title}"`,
      );
    }
  };

  private readonly archivePreviousVersions = async (
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

  private readonly findOne = async (
    tx: Transaction,
    id: string,
  ): Promise<DocumentSummary> => {
    const rows = await tx
      .select(SUMMARY_COLUMNS)
      .from(documents)
      .innerJoin(departments, eq(departments.id, documents.departmentId))
      .where(eq(documents.id, id))
      .limit(1);

    const document = rows[0];
    if (document === undefined) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    return {
      ...document,
      effectiveTo: toIsoOrNull(document.effectiveTo),
      createdAt: document.createdAt.toISOString(),
    };
  };
}
