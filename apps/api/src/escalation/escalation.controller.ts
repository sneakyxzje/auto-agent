import {
  type AnswerTicketInput,
  type ApproveCandidateInput,
  answerTicketSchema,
  approveCandidateSchema,
  type EscalationTicket,
  type KnowledgeCandidate,
  type ReassignTicketInput,
  reassignTicketSchema,
  type TicketStatus,
} from '@chatbot/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../core/auth/current-user';
import { JwtGuard } from '../core/auth/jwt.guard';
import { RequireRole, RolesGuard } from '../core/auth/roles.guard';
import type { AccessTokenClaims } from '../core/auth/token.service';
import { ZodBody } from '../core/http/zod-body.pipe';
import { CurationService } from './curation.service';
import { EscalationService } from './escalation.service';

const TICKET_STATUSES = ['open', 'answered', 'overdue', 'closed'] as const;
const CANDIDATE_STATUSES = ['pending', 'approved', 'rejected'] as const;

const asTicketStatus = (value: string | undefined): TicketStatus | null =>
  (TICKET_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as TicketStatus)
    : null;

/**
 * Cả phiếu chuyển lẫn hàng đợi duyệt đều là việc của người phụ trách, không phải
 * của người hỏi. Gắn `manager` ở mức class để không route nào lọt ra ngoài vì
 * quên đánh dấu — thêm endpoint mới là nó tự được bảo vệ.
 */
@Controller()
@UseGuards(JwtGuard, RolesGuard)
@RequireRole('manager')
export class EscalationController {
  constructor(
    private readonly escalation: EscalationService,
    private readonly curation: CurationService,
  ) {}

  @Get('escalations')
  async listTickets(
    @Query('status') status?: string,
  ): Promise<EscalationTicket[]> {
    return this.escalation.list(asTicketStatus(status));
  }

  @Post('escalations/:id/answer')
  @HttpCode(HttpStatus.OK)
  async answer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(answerTicketSchema)) input: AnswerTicketInput,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<{ ok: true }> {
    await this.escalation.answer(id, input.answer, user.userId);

    return { ok: true };
  }

  @Post('escalations/:id/reassign')
  @HttpCode(HttpStatus.OK)
  async reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(reassignTicketSchema)) input: ReassignTicketInput,
  ): Promise<{ ok: true }> {
    await this.escalation.reassign(id, input.departmentId);

    return { ok: true };
  }

  @Get('candidates')
  async listCandidates(
    @Query('status') status?: string,
  ): Promise<KnowledgeCandidate[]> {
    const wanted = (CANDIDATE_STATUSES as readonly string[]).includes(
      status ?? '',
    )
      ? (status as 'pending' | 'approved' | 'rejected')
      : 'pending';

    return this.curation.list(wanted);
  }

  @Post('candidates/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(approveCandidateSchema)) input: ApproveCandidateInput,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<{ ok: true }> {
    await this.curation.approve(id, input, user.userId);

    return { ok: true };
  }

  @Post('candidates/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<{ ok: true }> {
    await this.curation.reject(id, user.userId);

    return { ok: true };
  }
}
