import type { Member, UserRole } from '@chatbot/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { users } from '../../db/schema/user';
import { TenantDb } from '../../db/tenant-db.service';
import { TokenService } from '../auth/token.service';

@Injectable()
export class MemberService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly tokenService: TokenService,
  ) {}

  readonly list = async (): Promise<Member[]> =>
    this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          status: users.status,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);

      return rows.map((row) => ({
        ...row,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
    });

  /**
   * Đổi vai trò rồi huỷ sạch phiên của người đó.
   *
   * Vai trò nằm trong access token, không tra lại CSDL mỗi request. Không huỷ phiên
   * thì người vừa bị hạ quyền vẫn giữ nguyên quyền cũ tới 15 phút — quá lâu cho một
   * thao tác mà admin làm chính vì muốn chặn ngay.
   */
  readonly setRole = async (
    memberId: string,
    role: UserRole,
    actorId: string,
  ): Promise<Member> => {
    if (memberId === actorId) {
      throw new BadRequestException(
        'Không tự đổi vai trò của chính mình được. Nhờ một quản trị viên khác.',
      );
    }

    const member = await this.tenantDb.run(async (tx) => {
      await this.assertNotLastAdmin(tx, memberId, role);

      const updated = await tx
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, memberId))
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          status: users.status,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        });

      const found = updated[0];
      if (found === undefined) {
        throw new NotFoundException('Không tìm thấy thành viên');
      }

      return found;
    });

    await this.tokenService.revokeAllSessions(memberId);

    return {
      ...member,
      lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
      createdAt: member.createdAt.toISOString(),
    };
  };

  /** Công ty mất hết admin thì không còn ai tạo phòng ban hay phân quyền được nữa. */
  private readonly assertNotLastAdmin = async (
    tx: Parameters<Parameters<TenantDb['run']>[0]>[0],
    memberId: string,
    nextRole: UserRole,
  ): Promise<void> => {
    if (nextRole === 'admin') return;

    const others = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), ne(users.id, memberId)))
      .limit(1);

    if (others.length === 0) {
      throw new BadRequestException(
        'Công ty phải còn ít nhất một quản trị viên. Cấp quyền cho người khác trước.',
      );
    }
  };
}
