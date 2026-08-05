import type { CurrentUser, LoginInput, RegisterInput } from '@chatbot/contracts';
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
    if (candidate.code === UNIQUE_VIOLATION && candidate.constraint === constraint) return true;
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

  /**
   * Chỉ tạo tài khoản, `tenantId` để rỗng. Việc chọn tạo công ty hay nhập mã mời
   * nằm ở bước sau. Đăng ký xong cấp token luôn, không bắt gõ lại mật khẩu.
   */
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
          isTenantAdmin: users.isTenantAdmin,
          isExternal: users.isExternal,
        });

      const user = inserted[0];
      if (user === undefined) throw new Error('Không ghi được người dùng');

      return this.issueTokens({
        userId: user.id,
        tenantId: user.tenantId,
        isTenantAdmin: user.isTenantAdmin,
        isExternal: user.isExternal,
      });
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw error;
    }
  };

  /**
   * Email không tồn tại và mật khẩu sai đều trả về đúng một thông báo. Nếu phân
   * biệt hai trường hợp, kẻ tấn công thử hàng loạt email là dò ra được email nào
   * có tài khoản trong hệ thống.
   *
   * Cùng lý do, khi không tìm thấy email vẫn phải chạy `verifyPassword` với một
   * chuỗi băm giả: không làm vậy thì email sai trả lời trong 1ms còn email đúng
   * mất 40ms, và chênh lệch đó cũng đủ để dò.
   */
  readonly login = async (input: LoginInput): Promise<AuthTokens> => {
    const found = await this.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        passwordHash: users.passwordHash,
        isTenantAdmin: users.isTenantAdmin,
        isExternal: users.isExternal,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    const user = found[0];
    const matched = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);

    if (user === undefined || !matched || user.status !== 'active') {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    return this.issueTokens({
      userId: user.id,
      tenantId: user.tenantId,
      isTenantAdmin: user.isTenantAdmin,
      isExternal: user.isExternal,
    });
  };

  /**
   * `leftJoin` chứ không phải `innerJoin`: người vừa đăng ký chưa có công ty, dùng
   * `innerJoin` thì truy vấn trả về rỗng và họ thành "không tồn tại".
   *
   * `tenant: null` chính là tín hiệu để giao diện hiện màn hình chọn tạo công ty
   * hay nhập mã mời.
   */
  readonly getCurrentUser = async (userId: string): Promise<CurrentUser> => {
    const found = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isExternal: users.isExternal,
        isTenantAdmin: users.isTenantAdmin,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(users)
      .leftJoin(tenants, eq(tenants.id, users.tenantId))
      .where(eq(users.id, userId))
      .limit(1);

    const row = found[0];

    /**
     * Token hợp lệ nhưng người dùng không còn trong CSDL — tài khoản vừa bị xoá mà
     * token cũ chưa hết hạn. Trả 404 để client biết đường xoá phiên.
     */
    if (row === undefined) {
      throw new NotFoundException('Tài khoản không còn tồn tại');
    }

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      isExternal: row.isExternal,
      isTenantAdmin: row.isTenantAdmin,
      tenant:
        row.tenantId === null || row.tenantName === null || row.tenantSlug === null
          ? null
          : { id: row.tenantId, name: row.tenantName, slug: row.tenantSlug },
    };
  };

  readonly logout = async (refreshToken: string): Promise<void> =>
    this.tokenService.revokeRefreshToken(refreshToken);

  private readonly issueTokens = async (claims: AccessTokenClaims): Promise<AuthTokens> => ({
    accessToken: await this.tokenService.issueAccessToken(claims),
    refreshToken: await this.tokenService.issueRefreshToken(claims.userId),
  });
}

/**
 * Chuỗi băm hợp lệ của một mật khẩu không ai biết. Chỉ dùng để `verifyPassword`
 * vẫn tốn đúng chừng đó thời gian khi email không tồn tại.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZXg$J8pQMDIbnZ1PXNc5wRB1r5UlF9vD5ZgVYqPqXqTPXqI';
