import type { EscalationTicket, TicketStatus } from '@chatbot/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ChatSettingsService } from '../chat/chat-settings.service';
import { departments } from '../db/schema/department';
import { escalationTickets } from '../db/schema/escalation';
import { messages } from '../db/schema/message';
import { TenantDb } from '../db/tenant-db.service';
import { CurationService } from './curation.service';

export type CreatedTicket = {
  id: string;
  departmentSlug: string;
  departmentName: string;
};

/** Phòng nào xuất hiện nhiều nhất trong các đoạn điểm cao thì nhận phiếu. */
const majorityDepartment = (departmentIds: string[]): string | null => {
  const counts = new Map<string, number>();

  for (const id of departmentIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  let best: string | null = null;
  let bestCount = 0;

  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }

  return best;
};

@Injectable()
export class EscalationService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly settings: ChatSettingsService,
    private readonly curation: CurationService,
  ) {}

  readonly list = async (
    status: TicketStatus | null,
  ): Promise<EscalationTicket[]> =>
    this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: escalationTickets.id,
          conversationId: escalationTickets.conversationId,
          departmentId: escalationTickets.departmentId,
          departmentName: departments.name,
          question: escalationTickets.question,
          status: escalationTickets.status,
          dueAt: escalationTickets.dueAt,
          answerText: escalationTickets.answerText,
          answeredAt: escalationTickets.answeredAt,
          createdAt: escalationTickets.createdAt,
        })
        .from(escalationTickets)
        .innerJoin(
          departments,
          eq(departments.id, escalationTickets.departmentId),
        )
        .where(
          status === null ? undefined : eq(escalationTickets.status, status),
        )
        .orderBy(escalationTickets.dueAt);

      return rows.map((row) => ({
        ...row,
        dueAt: row.dueAt.toISOString(),
        answeredAt: row.answeredAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
    });

  /**
   * Người phụ trách trả lời: câu trả lời về thẳng hội thoại của người hỏi, và
   * một ứng viên tri thức được sinh ra ngay trong cùng lời gọi này.
   *
   * Sinh ứng viên nằm ở đây chứ không ở controller là có chủ đích: đó là mắt xích
   * khiến bot ngày càng biết nhiều hơn, không được phép quên gọi ở một đường nào.
   */
  readonly answer = async (
    ticketId: string,
    answerText: string,
    userId: string,
  ): Promise<void> => {
    const ticket = await this.tenantDb.run(async (tx, tenantId) => {
      const updated = await tx
        .update(escalationTickets)
        .set({
          answerText,
          answeredAt: new Date(),
          status: 'answered',
          assigneeId: userId,
          updatedAt: new Date(),
        })
        .where(eq(escalationTickets.id, ticketId))
        .returning({
          id: escalationTickets.id,
          conversationId: escalationTickets.conversationId,
          question: escalationTickets.question,
        });

      const found = updated[0];
      if (found === undefined) {
        throw new NotFoundException('Không tìm thấy phiếu chuyển');
      }

      // Người hỏi thấy câu trả lời ngay trong mạch hội thoại cũ của họ.
      await tx.insert(messages).values({
        tenantId,
        conversationId: found.conversationId,
        role: 'assistant',
        content: `Người phụ trách trả lời:\n\n${answerText}`,
      });

      return found;
    });

    await this.curation.createFromAnswer({
      ticketId: ticket.id,
      question: ticket.question,
      rawAnswer: answerText,
    });
  };

  /** Gán nhầm phòng thì chuyển, và hạn SLA tính lại từ đầu cho phòng mới. */
  readonly reassign = async (
    ticketId: string,
    departmentId: string,
  ): Promise<void> => {
    const config = await this.settings.load();

    await this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(escalationTickets)
        .set({
          departmentId,
          dueAt: new Date(Date.now() + config.escalationSlaHours * 3_600_000),
          updatedAt: new Date(),
        })
        .where(eq(escalationTickets.id, ticketId))
        .returning({ id: escalationTickets.id });

      if (updated[0] === undefined) {
        throw new NotFoundException('Không tìm thấy phiếu chuyển');
      }
    });
  };

  /**
   * Bot không đủ căn cứ thì câu hỏi phải rơi vào tay người, không rơi vào hư không.
   *
   * Thứ tự chọn phòng theo FR-5: bộ lọc đang bật trước, rồi tới phòng chiếm đa số
   * trong các đoạn điểm cao — kể cả những đoạn bước gate đã loại, vì chúng vẫn cho
   * biết câu hỏi thuộc địa phận ai.
   *
   * Phần realtime, webhook và trả lời phiếu thuộc B4; ở đây mới là ghi phiếu.
   */
  readonly createFromChat = async (input: {
    conversationId: string;
    question: string;
    hintDepartmentId: string | null;
    retrievedDepartmentIds: string[];
    slaHours: number;
  }): Promise<CreatedTicket | null> =>
    this.tenantDb.run(async (tx, tenantId) => {
      const candidate =
        input.hintDepartmentId ??
        majorityDepartment(input.retrievedDepartmentIds);

      const rows =
        candidate === null
          ? await tx
              .select({
                id: departments.id,
                slug: departments.slug,
                name: departments.name,
              })
              .from(departments)
              .where(eq(departments.isActive, true))
              .orderBy(departments.name)
              .limit(1)
          : await tx
              .select({
                id: departments.id,
                slug: departments.slug,
                name: departments.name,
              })
              .from(departments)
              .where(
                and(
                  eq(departments.id, candidate),
                  eq(departments.isActive, true),
                ),
              )
              .limit(1);

      const department = rows[0];
      if (department === undefined) return null;

      const created = await tx
        .insert(escalationTickets)
        .values({
          tenantId,
          conversationId: input.conversationId,
          departmentId: department.id,
          question: input.question,
          dueAt: new Date(Date.now() + input.slaHours * 3_600_000),
        })
        .returning({ id: escalationTickets.id });

      const ticket = created[0];
      if (ticket === undefined) return null;

      return {
        id: ticket.id,
        departmentSlug: department.slug,
        departmentName: department.name,
      };
    });
}
