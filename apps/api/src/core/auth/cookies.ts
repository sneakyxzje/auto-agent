import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './token.service';

export const ACCESS_TOKEN_COOKIE = 'at';
export const REFRESH_TOKEN_COOKIE = 'rt';

/** Refresh token chỉ được gửi tới nhóm endpoint auth, không đi kèm mọi request. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  maxAge?: number;
};

/**
 * `@fastify/cookie` có kèm phần mở rộng kiểu cho `FastifyReply`, nhưng nó khai
 * `interface FastifyReply` không có generic trong khi bản gốc có 8 tham số —
 * TypeScript chỉ gộp hai khai báo interface khi danh sách generic trùng khớp, nên
 * phần mở rộng đó không bao giờ áp vào. Lúc chạy plugin hoạt động bình thường.
 *
 * Ép kiểu gói gọn trong hai hàm dưới đây, không rải ra chỗ khác. Đổi lại còn thấy
 * rõ dự án dùng đúng những API nào của plugin.
 */
type CookieReply = {
  setCookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: Pick<CookieOptions, 'path'>): unknown;
};

const asCookieReply = (reply: FastifyReply): CookieReply =>
  reply as unknown as CookieReply;

const asCookieRequest = (
  request: FastifyRequest,
): { cookies: Record<string, string | undefined> } =>
  request as unknown as { cookies: Record<string, string | undefined> };

export const readCookie = (
  request: FastifyRequest,
  name: string,
): string | undefined => asCookieRequest(request).cookies[name];

/**
 * `httpOnly` là điểm quan trọng nhất: JavaScript trên trang không đọc được cookie
 * này, nên kẻ chèn được script vào web cũng không lấy được token.
 *
 * `sameSite` chống CSRF — trình duyệt không gửi cookie khi request xuất phát từ web
 * khác. Access token để `lax` cho điều hướng thông thường vẫn chạy; refresh token
 * để `strict` vì nó quyền lực hơn và chỉ dùng ở đúng một nhóm endpoint.
 *
 * `secure` bật ở production để cookie chỉ đi qua HTTPS. Ở localhost phải tắt, nếu
 * không trình duyệt lặng lẽ bỏ qua cookie và bạn sẽ ngồi debug nhầm chỗ.
 */
export const setAuthCookies = (
  reply: FastifyReply,
  isProduction: boolean,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  const cookieReply = asCookieReply(reply);

  cookieReply.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  cookieReply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
};

export const setAccessTokenCookie = (
  reply: FastifyReply,
  isProduction: boolean,
  accessToken: string,
): void => {
  asCookieReply(reply).setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
};

export const clearAuthCookies = (reply: FastifyReply): void => {
  const cookieReply = asCookieReply(reply);
  cookieReply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  cookieReply.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_COOKIE_PATH });
};
