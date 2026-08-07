import { Inject, Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import { CHAT_CLIENT, emptyUsage, type TokenUsage } from './llm.tokens';

export type StructuredCall<T> = {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  /** JSON Schema viết tay: strict mode đòi mọi trường required và no extra keys. */
  jsonSchema: Record<string, unknown>;
  parse: (value: unknown) => T;
  maxOutputTokens?: number;
  /** Đặt 0 cho các quyết định phân loại cần lặp lại được giữa các lần gọi. */
  temperature?: number;
};

export type StructuredResult<T> = {
  value: T;
  usage: TokenUsage;
};

export type VisionStructuredCall<T> = {
  model: string;
  system: string;
  text: string;
  images: { mime: string; base64: string }[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  parse: (value: unknown) => T;
  maxOutputTokens?: number;
};

export type StreamCall = {
  model: string;
  system: string;
  user: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  maxOutputTokens?: number;
};

export type StreamPart =
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: TokenUsage };

const usageOf = (
  usage: OpenAI.Completions.CompletionUsage | undefined,
): TokenUsage => ({
  input: usage?.prompt_tokens ?? 0,
  output: usage?.completion_tokens ?? 0,
});

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(@Inject(CHAT_CLIENT) private readonly client: OpenAI) {}

  /**
   * Bước viết lại truy vấn và bước lọc+gate đều cần đầu ra có cấu trúc chắc chắn.
   * `strict: true` để nhà cung cấp ép theo schema thay vì mình đi vá JSON hỏng —
   * một lần model trả thiếu trường là cả lượt hỏi đáp gãy.
   */
  readonly structured = async <T>(
    call: StructuredCall<T>,
  ): Promise<StructuredResult<T>> =>
    this.requestStructured({
      model: call.model,
      messages: [
        { role: 'system', content: call.system },
        { role: 'user', content: call.user },
      ],
      maxOutputTokens: call.maxOutputTokens ?? 512,
      ...(call.temperature === undefined
        ? {}
        : { temperature: call.temperature }),
      schemaName: call.schemaName,
      jsonSchema: call.jsonSchema,
      parse: call.parse,
    });

  readonly visionStructured = async <T>(
    call: VisionStructuredCall<T>,
  ): Promise<StructuredResult<T>> =>
    this.requestStructured({
      model: call.model,
      messages: [
        { role: 'system', content: call.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: call.text },
            ...call.images.map((image) => ({
              type: 'image_url' as const,
              image_url: {
                url: `data:${image.mime};base64,${image.base64}`,
              },
            })),
          ],
        },
      ],
      maxOutputTokens: call.maxOutputTokens ?? 700,
      temperature: 0,
      schemaName: call.schemaName,
      jsonSchema: call.jsonSchema,
      parse: call.parse,
    });

  /**
   * Nhà cung cấp thỉnh thoảng trả JSON đứt giữa chừng (đã bắt gặp lặp lại trong
   * gate lẫn OCR). Thử lại đúng một lần trước khi bỏ cuộc — không phải vá schema,
   * chỉ chống trục trặc thoáng qua ở tầng mạng/model.
   */
  private readonly requestStructured = async <T>(input: {
    model: string;
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    maxOutputTokens: number;
    temperature?: number;
    schemaName: string;
    jsonSchema: Record<string, unknown>;
    parse: (value: unknown) => T;
  }): Promise<StructuredResult<T>> => {
    this.assertModel(input.model);

    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await this.client.chat.completions.create({
        model: input.model,
        messages: input.messages,
        max_completion_tokens: input.maxOutputTokens,
        ...(input.temperature === undefined
          ? {}
          : { temperature: input.temperature }),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: input.schemaName,
            strict: true,
            schema: input.jsonSchema,
          },
        },
      });

      const content = completion.choices[0]?.message.content ?? '';

      try {
        return {
          value: input.parse(JSON.parse(content)),
          usage: usageOf(completion.usage),
        };
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Model trả JSON hỏng cho ${input.schemaName} (lần ${attempt}/2)`,
        );
      }
    }

    throw lastError;
  };

  /**
   * Stream text thuần, không stream JSON: marker trích dẫn được validate ngay
   * trong lúc chạy nên phần hiện ra phải là text đọc được từ token đầu tiên.
   */
  async *stream(call: StreamCall): AsyncGenerator<StreamPart> {
    this.assertModel(call.model);

    const stream = await this.client.chat.completions.create({
      model: call.model,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: call.maxOutputTokens ?? 1200,
      messages: [
        { role: 'system', content: call.system },
        ...call.history,
        { role: 'user', content: call.user },
      ],
    });

    let usage = emptyUsage();

    for await (const part of stream) {
      const text = part.choices[0]?.delta?.content;
      if (typeof text === 'string' && text.length > 0) {
        yield { type: 'delta', text };
      }

      if (part.usage != null) usage = usageOf(part.usage);
    }

    yield { type: 'usage', usage };
  }

  private readonly assertModel = (model: string): void => {
    if (model.trim().length === 0) {
      this.logger.error(
        'Thiếu tên model — kiểm tra LLM_MODEL_BIG/LLM_MODEL_SMALL',
      );
      throw new Error(
        'Chưa cấu hình tên model cho LLM. Đặt LLM_MODEL_BIG và LLM_MODEL_SMALL trong .env',
      );
    }
  };
}
