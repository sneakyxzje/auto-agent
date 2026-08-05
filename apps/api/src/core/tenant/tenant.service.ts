import type { CreateTenantInput, JoinTenantInput } from '@chatbot/contracts';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AUTH_DATABASE, type Database } from '../../db/database.tokens';
import { invitations } from '../../db/schema/invitation';
import { tenants } from '../../db/schema/tenant';
import { users } from '../../db/schema/user';
import { randomSuffix, toSlug } from '../auth/slug';
import type { AccessTokenClaims } from '../auth/token.service';

export type OnboardingResult = {
  tenant: { id: string; name: string; slug: string };
  claims: AccessTokenClaims;
};

@Injectable()
export class TenantService {
  constructor(@Inject(AUTH_DATABASE) private readonly db: Database) {}

  readonly createForUser = async (
    userId: string,
    input: CreateTenantInput,
  ): Promise<OnboardingResult> =>
    this.db.transaction(async (tx) => {
      await this.assertUserHasNoTenant(tx, userId);

      const slug = await this.buildUniqueSlug(tx, input.companyName);
      const created = await tx
        .insert(tenants)
        .values({ name: input.companyName, slug })
        .returning({ id: tenants.id, name: tenants.name, slug: tenants.slug });

      const tenant = created[0];
      if (tenant === undefined) throw new Error('Không tạo được công ty');

      const updated = await tx
        .update(users)
        .set({
          tenantId: tenant.id,
          isExternal: false,
          isTenantAdmin: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          isTenantAdmin: users.isTenantAdmin,
          isExternal: users.isExternal,
        });

      const user = updated[0];
      if (user === undefined)
        throw new NotFoundException('Không tìm thấy tài khoản');

      return {
        tenant,
        claims: {
          userId: user.id,
          tenantId: tenant.id,
          isTenantAdmin: user.isTenantAdmin,
          isExternal: user.isExternal,
        },
      };
    });

  readonly joinWithInvite = async (
    userId: string,
    input: JoinTenantInput,
  ): Promise<OnboardingResult> =>
    this.db.transaction(async (tx) => {
      await this.assertUserHasNoTenant(tx, userId);

      const code = input.inviteCode.trim().toUpperCase();
      const claimed = await tx
        .update(invitations)
        .set({ usedCount: sql`${invitations.usedCount} + 1` })
        .where(
          and(
            eq(invitations.code, code),
            isNull(invitations.revokedAt),
            sql`${invitations.expiresAt} > now()`,
            sql`${invitations.usedCount} < ${invitations.maxUses}`,
          ),
        )
        .returning({
          tenantId: invitations.tenantId,
          grantsTenantAdmin: invitations.grantsTenantAdmin,
        });

      const invitation = claimed[0];
      if (invitation === undefined) {
        throw new BadRequestException(
          'Mã mời không đúng, đã hết lượt hoặc hết hạn',
        );
      }

      const found = await tx
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, invitation.tenantId))
        .limit(1);

      const tenant = found[0];
      if (tenant === undefined)
        throw new NotFoundException('Công ty không còn tồn tại');

      const updated = await tx
        .update(users)
        .set({
          tenantId: tenant.id,
          isExternal: false,
          isTenantAdmin: invitation.grantsTenantAdmin,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          isTenantAdmin: users.isTenantAdmin,
          isExternal: users.isExternal,
        });

      const user = updated[0];
      if (user === undefined)
        throw new NotFoundException('Không tìm thấy tài khoản');

      return {
        tenant,
        claims: {
          userId: user.id,
          tenantId: tenant.id,
          isTenantAdmin: user.isTenantAdmin,
          isExternal: user.isExternal,
        },
      };
    });

  private readonly assertUserHasNoTenant = async (
    tx: Pick<Database, 'select'>,
    userId: string,
  ): Promise<void> => {
    const found = await tx
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = found[0];
    if (user === undefined)
      throw new NotFoundException('Không tìm thấy tài khoản');
    if (user.tenantId !== null) {
      throw new BadRequestException('Tài khoản đã thuộc một công ty');
    }
  };

  private readonly buildUniqueSlug = async (
    tx: Pick<Database, 'select'>,
    companyName: string,
  ): Promise<string> => {
    const base = toSlug(companyName) || 'cong-ty';
    const taken = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, base));

    return taken.length === 0 ? base : `${base}-${randomSuffix()}`;
  };
}
