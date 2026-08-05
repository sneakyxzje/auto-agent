import type { LoginInput, RegisterInput } from '@chatbot/contracts';
import { postJson } from '@/lib/api-client';

/**
 * Không hàm nào ở đây trả về token: token nằm trong cookie httpOnly do server đặt,
 * JavaScript cố tình không đọc được. Phản hồi chỉ là `{ ok: true }`.
 */
type AuthResponse = { ok: true };

export const register = (input: RegisterInput): Promise<AuthResponse> =>
  postJson<AuthResponse>('/v1/auth/register', input);

export const login = (input: LoginInput): Promise<AuthResponse> =>
  postJson<AuthResponse>('/v1/auth/login', input);

export const logout = (): Promise<AuthResponse> =>
  postJson<AuthResponse>('/v1/auth/logout', {});
