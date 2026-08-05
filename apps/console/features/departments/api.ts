import type { CreateDepartment } from '@chatbot/contracts';
import { apiRequest, postJson } from '@/lib/api-client';

export type DepartmentSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
};

export const listDepartments = (): Promise<DepartmentSummary[]> =>
  apiRequest<DepartmentSummary[]>('/v1/departments');

export const createDepartment = (
  input: CreateDepartment,
): Promise<DepartmentSummary> =>
  postJson<DepartmentSummary>('/v1/departments', input);

const removeDiacritics = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

export const toSlug = (text: string): string =>
  removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
