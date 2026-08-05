import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { emptyUsage, type TokenUsage } from '../llm/llm.tokens';
import type { ChatConfig } from './chat-settings.service';

export type HistoryTurn = {
  question: string;
  /** Chỉ phần đầu câu trả lời — đủ để hiểu mạch, không đủ để nhiễu. */
  answerPreview: string;
};

export type RewriteResult = {
  standaloneQuery: string;
  isFollowup: boolean;
  usage: TokenUsage;
};

const SCHEMA = {
  type: 'object',
  properties: {
    is_followup: { type: 'boolean' },
    standalone_query: { type: 'string' },
  },
  required: ['is_followup', 'standalone_query'],
  additionalProperties: false,
};

const parse = (value: unknown): { isFollowup: boolean; query: string } => {
  const raw = value as { is_followup?: unknown; standalone_query?: unknown };

  return {
    isFollowup: raw.is_followup === true,
    query: typeof raw.standalone_query === 'string' ? raw.standalone_query : '',
  };
};

@Injectable()
export class RewriteService {
  constructor(private readonly llm: LlmService) {}

  /**
   * Biến câu hỏi nối tiếp thành câu hỏi độc lập trước khi đem đi tìm kiếm.
   *
   * Lượt đầu tiên bỏ qua hẳn bước này: chưa có ngữ cảnh nào để giải quyết, gọi
   * thêm một lượt model chỉ tốn tiền và ăn mất vài trăm mili-giây của ngân sách 3s.
   */
  readonly rewrite = async (
    config: ChatConfig,
    history: HistoryTurn[],
    question: string,
  ): Promise<RewriteResult> => {
    if (history.length === 0) {
      return {
        standaloneQuery: question,
        isFollowup: false,
        usage: emptyUsage(),
      };
    }

    const transcript = history
      .map(
        (turn, index) =>
          `Lượt ${index + 1}\nNgười dùng: ${turn.question}\nBot: ${turn.answerPreview}`,
      )
      .join('\n\n');

    const { value, usage } = await this.llm.structured({
      model: config.modelSmall,
      system: config.promptRewrite,
      user: `HỘI THOẠI TRƯỚC ĐÓ\n${transcript}\n\nCÂU HỎI MỚI\n${question}`,
      schemaName: 'query_rewrite',
      jsonSchema: SCHEMA,
      parse,
      maxOutputTokens: 256,
    });

    return {
      standaloneQuery: value.query.trim().length > 0 ? value.query : question,
      isFollowup: value.isFollowup,
      usage,
    };
  };
}
