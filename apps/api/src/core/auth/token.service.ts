import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { jwtVerify, SignJWT } from 'jose';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { REDIS } from '../../redis/redis.module';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Nội dung nhét vào access token. Giữ tối thiểu: token đi kèm mọi request nên càng
 * to càng tốn băng thông, và mọi thứ ở đây đều là bản chụp tại thời điểm phát —
 * đổi quyền cho ai đó thì phải đợi token cũ hết hạn mới có hiệu lực.
 */
export type AccessTokenClaims = {
  userId: string;
  /** Rỗng khi người dùng chưa tạo hay chưa vào công ty nào. */
  tenantId: string | null;
  isTenantAdmin: boolean;
  isExternal: boolean;
};

type StoredSession = {
  userId: string;
};

const refreshKey = (token: string): string => `rt:${token}`;
const sessionsKey = (userId: string): string => `sessions:${userId}`;

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
  }

  /**
   * Access token là JWT có chữ ký: server đọc ra là biết ngay ai đang gọi, không
   * cần tra CSDL. Đổi lại là không thu hồi được, nên hạn chỉ 15 phút.
   */
  readonly issueAccessToken = (claims: AccessTokenClaims): Promise<string> =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.secret);

  readonly verifyAccessToken = async (token: string): Promise<AccessTokenClaims | null> => {
    try {
      const { payload } = await jwtVerify<AccessTokenClaims>(token, this.secret);
      return {
        userId: payload.userId,
        tenantId: payload.tenantId,
        isTenantAdmin: payload.isTenantAdmin,
        isExternal: payload.isExternal,
      };
    } catch {
      return null;
    }
  };

  /**
   * Refresh token KHÔNG phải JWT — chỉ là chuỗi ngẫu nhiên, ý nghĩa nằm ở Redis.
   * Nhờ vậy xoá khỏi Redis là nó chết ngay, không phải đợi hết hạn.
   *
   * Lưu hai chiều: `rt:<token>` để tra ngược ra người dùng, và `sessions:<userId>`
   * để xoá sạch mọi phiên của một người mà không phải quét toàn bộ Redis.
   */
  readonly issueRefreshToken = async (userId: string): Promise<string> => {
    const token = randomBytes(32).toString('base64url');
    const session: StoredSession = { userId };

    await this.redis
      .multi()
      .set(refreshKey(token), JSON.stringify(session), 'EX', REFRESH_TOKEN_TTL_SECONDS)
      .sadd(sessionsKey(userId), token)
      .expire(sessionsKey(userId), REFRESH_TOKEN_TTL_SECONDS)
      .exec();

    return token;
  };

  readonly readRefreshToken = async (token: string): Promise<StoredSession | null> => {
    const raw = await this.redis.get(refreshKey(token));
    return raw === null ? null : (JSON.parse(raw) as StoredSession);
  };

  readonly revokeRefreshToken = async (token: string): Promise<void> => {
    const session = await this.readRefreshToken(token);
    if (session === null) return;

    await this.redis.multi().del(refreshKey(token)).srem(sessionsKey(session.userId), token).exec();
  };

  /** Dùng khi nhân viên nghỉ việc hoặc admin khoá tài khoản. */
  readonly revokeAllSessions = async (userId: string): Promise<void> => {
    const tokens = await this.redis.smembers(sessionsKey(userId));
    const keys = tokens.map(refreshKey);

    await this.redis
      .multi()
      .del(...(keys.length > 0 ? keys : ['rt:none']))
      .del(sessionsKey(userId))
      .exec();
  };
}
