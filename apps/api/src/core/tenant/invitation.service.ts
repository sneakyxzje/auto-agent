import type { CreateInvitationInput, Invitation } from '@chatbot/contracts';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { invitations } from '../../db/schema/invitation';
import { TenantDb } from '../../db/tenant-db.service';
import { readRequestContext } from '../context/request-context';
import { generateInviteCode } from './invite-code';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationService {
  constructor(private readonly tenantDb: TenantDb) {}

  readonly create = async (
    input: CreateInvitationInput,
  ): Promise<Invitation> => {
    const context = readRequestContext();
    const tenantId = context?.tenantId ?? null;

    if (tenantId === null) {
      throw new ForbiddenException('Tài khoản chưa thuộc công ty nào');
    }

    return this.tenantDb.run(async (tx) => {
      const created = await tx
        .insert(invitations)
        .values({
          tenantId,
          code: generateInviteCode(),
          maxUses: input.maxUses,
          grantsRole: input.grantsRole,
          expiresAt: new Date(Date.now() + input.expiresInDays * DAY_IN_MS),
          createdBy: context?.userId ?? null,
        })
        .returning({
          id: invitations.id,
          code: invitations.code,
          maxUses: invitations.maxUses,
          usedCount: invitations.usedCount,
          expiresAt: invitations.expiresAt,
          grantsRole: invitations.grantsRole,
        });

      const invitation = created[0];
      if (invitation === undefined) throw new Error('Không tạo được mã mời');

      return { ...invitation, expiresAt: invitation.expiresAt.toISOString() };
    });
  };
}
