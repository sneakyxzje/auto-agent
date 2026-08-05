import { Injectable } from '@nestjs/common';
import type { RetrievedChunk } from '../knowledge/search/search.service';
import { LlmService } from '../llm/llm.service';
import type { TokenUsage } from '../llm/llm.tokens';
import type { ChatConfig } from './chat-settings.service';

export type GateResult = {
  relevantHandles: string[];
  enoughToAnswer: boolean;
  usage: TokenUsage;
};

const SCHEMA = {
  type: 'object',
  properties: {
    relevant_chunk_ids: { type: 'array', items: { type: 'string' } },
    enough_to_answer: { type: 'boolean' },
  },
  required: ['relevant_chunk_ids', 'enough_to_answer'],
  additionalProperties: false,
};

const parse = (value: unknown): { ids: string[]; enough: boolean } => {
  const raw = value as {
    relevant_chunk_ids?: unknown;
    enough_to_answer?: unknown;
  };

  return {
    ids: Array.isArray(raw.relevant_chunk_ids)
      ? raw.relevant_chunk_ids.filter(
          (id): id is string => typeof id === 'string',
        )
      : [],
    enough: raw.enough_to_answer === true,
  };
};

@Injectable()
export class GateService {
  constructor(private readonly llm: LlmService) {}

  /**
   * Một lần gọi model nhỏ vừa lọc đoạn vừa quyết định có đủ căn cứ để trả lời.
   *
   * `enough_to_answer` là cơ chế quyết định duy nhất — không có ngưỡng điểm nào ở
   * đây, và cũng không hỏi model tự chấm độ tự tin vì con số đó không calibrated.
   *
   * Chỉ đưa `gateTopK` đoạn tốt nhất và cắt mỗi đoạn còn `gateChunkChars` ký tự:
   * 20 đoạn nguyên văn là ~14k token, đủ để một mình bước này ăn hết ngân sách 3s.
   */
  readonly evaluate = async (
    config: ChatConfig,
    question: string,
    candidates: { handle: string; chunk: RetrievedChunk }[],
  ): Promise<GateResult> => {
    const listed = candidates
      .slice(0, config.gateTopK)
      .map(
        ({ handle, chunk }) =>
          `[${handle}] (${chunk.departmentName} — ${chunk.documentTitle})\n${chunk.content.slice(
            0,
            config.gateChunkChars,
          )}`,
      )
      .join('\n\n---\n\n');

    const { value, usage } = await this.llm.structured({
      model: config.modelSmall,
      system: config.promptGate,
      user: `CÂU HỎI\n${question}\n\nCÁC ĐOẠN TÀI LIỆU\n${listed}`,
      schemaName: 'chunk_gate',
      jsonSchema: SCHEMA,
      parse,
      maxOutputTokens: 512,
    });

    const known = new Set(candidates.map((candidate) => candidate.handle));

    return {
      relevantHandles: value.ids.filter((id) => known.has(id)),
      enoughToAnswer: value.enough,
      usage,
    };
  };
}
