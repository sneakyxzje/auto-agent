import type {
  CurrentUser,
  LoginInput,
  RegisterInput,
} from '@chatbot/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AUTH_DATABASE, type Database } from '../../db/drizzle.module';
import { tenants } from '../../db/schema/tenant';
import { users } from '../../db/schema/user';
import { hashPassword, verifyPassword } from './password';
import { type AccessTokenClaims, TokenService } from './token.service';

/** Mã lỗi Postgres cho "vi phạm ràng buộc UNIQUE". */
const UNIQUE_VIOLATION = '23505';

/**
 * Drizzle bọc lỗi của driver vào `DrizzleQueryError`, mã lỗi Postgres thật nằm ở
 * `cause`. Lần theo cả chuỗi để không phụ thuộc vào việc nó bọc mấy lớp.
 */
const isUniqueViolation = (error: unknown, constraint: string): boolean => {
  let current = error;

  while (typeof current === 'object' && current !== null) {
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (
      candidate.code === UNIQUE_VIOLATION &&
      candidate.constraint === constraint
    )
      return true;
    current = candidate.cause;
  }

  return false;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  /**
   * Dùng AUTH_DATABASE chứ không phải DATABASE: đây là role duy nhất đọc được bảng
   * `users` khi chưa biết người dùng thuộc công ty nào — mà lúc đăng ký và đăng
   * nhập thì đúng là chưa biết.
   */
  constructor(
    @Inject(AUTH_DATABASE) private readonly db: Database,
    private readonly tokenService: TokenService,
  ) {}

  readonly register = async (input: RegisterInput): Promise<AuthTokens> => {
    const passwordHash = await hashPassword(input.password);

    try {
      const inserted = await this.db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          displayName: input.displayName,
        })
        .returning({
          id: users.id,
          tenantId: users.tenantId,
          role: users.role,
          isExternal: users.isExternal,
        });

      const user = inserted[0];
      if (user === undefined) throw new Error('Không ghi được người dùng');

      return this.issueTokens({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        isExternal: user.isExternal,
      });
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw error;
    }
  };

  readonly login = async (input: LoginInput): Promise<AuthTokens> => {
    const found = await this.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        passwordHash: users.passwordHash,
        role: users.role,
        isExternal: users.isExternal,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    const user = found[0];
    const matched = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (user === undefined || !matched || user.status !== 'active') {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return this.issueTokens({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isExternal: user.isExternal,
    });
  };

  readonly getCurrentUser = async (userId: string): Promise<CurrentUser> => {
    const found = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isExternal: users.isExternal,
        role: users.role,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(users)
      .leftJoin(tenants, eq(tenants.id, users.tenantId))
      .where(eq(users.id, userId))
      .limit(1);

    const row = found[0];

    if (row === undefined) {
      throw new NotFoundException('Tài khoản không còn tồn tại');
    }

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      isExternal: row.isExternal,
      role: row.role,
      tenant:
        row.tenantId === null ||
        row.tenantName === null ||
        row.tenantSlug === null
          ? null
          : { id: row.tenantId, name: row.tenantName, slug: row.tenantSlug },
    };
  };

  readonly refresh = async (refreshToken: string): Promise<AuthTokens> => {
    const outcome = await this.tokenService.rotateRefreshToken(refreshToken);

    if (outcome.status !== 'ok') {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    const found = await this.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        role: users.role,
        isExternal: users.isExternal,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, outcome.userId))
      .limit(1);

    const user = found[0];

    if (user === undefined || user.status !== 'active') {
      await this.tokenService.revokeAllSessions(outcome.userId);
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }

    return {
      accessToken: await this.tokenService.issueAccessToken({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        isExternal: user.isExternal,
      }),
      refreshToken: outcome.refreshToken,
    };
  };

  readonly logout = async (refreshToken: string): Promise<void> =>
    this.tokenService.revokeRefreshToken(refreshToken);

  private readonly issueTokens = async (
    claims: AccessTokenClaims,
  ): Promise<AuthTokens> => ({
    accessToken: await this.tokenService.issueAccessToken(claims),
    refreshToken: await this.tokenService.issueRefreshToken(claims.userId),
  });
}

const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZXg$J8pQMDIbnZ1PXNc5wRB1r5UlF9vD5ZgVYqPqXqTPXqI';
