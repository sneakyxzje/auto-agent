import {
  type ChatRequest,
  type ConversationSummary,
  type ConversationTranscript,
  chatRequestSchema,
  type SseEvent,
  type UpdateConversationInput,
  updateConversationSchema,
} from '@chatbot/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../core/auth/current-user';
import { JwtGuard } from '../core/auth/jwt.guard';
import type { AccessTokenClaims } from '../core/auth/token.service';
import { ZodBody } from '../core/http/zod-body.pipe';
import { ChatService } from './chat.service';
import { ConversationService } from './conversation.service';

const encodeEvent = (event: SseEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`;

/** Thanh bên chỉ hiện chừng này, không làm phân trang cho tới khi thấy cần. */
const HISTORY_LIMIT = 30;

@Controller()
@UseGuards(JwtGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly conversations: ConversationService,
  ) {}

  /**
   * SSE là kênh stream DUY NHẤT của chat. Ghi thẳng vào reply thay vì dùng `@Sse()`
   * của Nest vì decorator đó buộc phải trả Observable và không nhận body POST —
   * mà câu hỏi kèm ảnh thì không nhét vừa query string.
   *
   * Lỗi giữa chừng cũng đi ra dưới dạng sự kiện `error`: response đã gửi header
   * 200 rồi, ném exception lúc này chỉ làm đứt kết nối mà client không biết vì sao.
   */
  @Post('chat')
  async chatStream(
    @Body(new ZodBody(chatRequestSchema)) input: ChatRequest,
    @CurrentUser() user: AccessTokenClaims,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // nginx đệm response theo mặc định, đệm thì stream mất ý nghĩa.
      'x-accel-buffering': 'no',
    });

    const stream = this.chat.run(
      {
        conversationId: input.conversationId ?? null,
        message: input.message,
        departmentSlug: input.departmentSlug ?? null,
      },
      user,
    );

    try {
      for await (const event of stream) {
        reply.raw.write(encodeEvent(event));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      reply.raw.write(
        encodeEvent({ type: 'error', code: 'chat_failed', message }),
      );
      reply.raw.write(encodeEvent({ type: 'done' }));
    } finally {
      reply.raw.end();
    }
  }

  @Get('conversations')
  async list(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<ConversationSummary[]> {
    return this.conversations.list(user.userId, HISTORY_LIMIT);
  }

  @Get('conversations/:id')
  async transcript(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationTranscript> {
    return this.conversations.transcript(id) as Promise<ConversationTranscript>;
  }

  @Patch('conversations/:id')
  async setHint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(updateConversationSchema)) input: UpdateConversationInput,
  ): Promise<ConversationTranscript> {
    await this.conversations.setHint(id, input.departmentSlug);

    return this.conversations.transcript(id) as Promise<ConversationTranscript>;
  }
}
