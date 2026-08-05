import type { CreateTenantInput, JoinTenantInput } from '@chatbot/contracts';
import { postJson } from '@/lib/api-client';

type TenantResponse = {
  tenant: { id: string; name: string; slug: string };
};

export const createTenant = (
  input: CreateTenantInput,
): Promise<TenantResponse> => postJson<TenantResponse>('/v1/tenants', input);

export const joinTenant = (input: JoinTenantInput): Promise<TenantResponse> =>
  postJson<TenantResponse>('/v1/tenants/join', input);
