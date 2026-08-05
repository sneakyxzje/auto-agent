import type { Document, UpdateDocumentInput } from '@chatbot/contracts';
import {
  API_BASE_URL,
  apiRequest,
  deleteRequest,
  patchJson,
  postForm,
  postJson,
} from '@/lib/api-client';

export type UploadDocumentFields = {
  file: File;
  title: string;
  departmentId: string;
  audience: 'internal' | 'public';
  effectiveTo: string;
};

export const listDocuments = (departmentId: string): Promise<Document[]> =>
  apiRequest<Document[]>(
    departmentId === ''
      ? '/v1/documents'
      : `/v1/documents?departmentId=${departmentId}`,
  );

/**
 * Metadata đi trước file trong FormData cho đúng thứ tự người đọc mong đợi; phía
 * API duyệt từng phần nên thứ tự nào cũng chạy.
 */
export const uploadDocument = (
  fields: UploadDocumentFields,
): Promise<Document> => {
  const form = new FormData();
  form.append('departmentId', fields.departmentId);
  form.append('title', fields.title);
  form.append('audience', fields.audience);
  form.append('effectiveTo', fields.effectiveTo);
  form.append('file', fields.file);

  return postForm<Document>('/v1/documents', form);
};

export const updateDocument = (
  id: string,
  input: UpdateDocumentInput,
): Promise<Document> => patchJson<Document>(`/v1/documents/${id}`, input);

export const archiveDocument = (id: string): Promise<Document> =>
  deleteRequest<Document>(`/v1/documents/${id}`);

export const reingestDocument = (id: string): Promise<Document> =>
  postJson<Document>(`/v1/documents/${id}/reingest`, {});

export const documentFileUrl = (id: string): string =>
  `${API_BASE_URL}/v1/documents/${id}/file`;
