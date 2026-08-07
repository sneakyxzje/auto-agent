import { Inject, Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { EMBEDDING_DIMENSIONS } from '../db/schema/chunk';
import { EMBEDDING_CLIENT } from './llm.tokens';

/**
 * `dimensions` chỉ có ở dòng text-embedding-3 của OpenAI (cắt vector theo kiểu
 * Matryoshka). Nhờ nó mà dùng được OpenAI mà vẫn giữ nguyên cột vector(1024) và
 * mô hình self-host cũ — không phải migrate cột lẫn tính lại embedding toàn kho.
 * Model khác (bge-m3 qua TEI) không hiểu tham số này nên phải bỏ đi.
 */
const supportsDimensions = (model: string): boolean =>
  model.startsWith('text-embedding-3');

/** Gửi cả mẻ trong một request; quá lớn thì nhà cung cấp từ chối. */
const BATCH_SIZE = 64;

/** Trên ngưỡng này thì nhà cung cấp embedding đang là nút thắt, phải nói ra. */
const SLOW_BATCH_MS = 10_000;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    @Inject(EMBEDDING_CLIENT) private readonly client: OpenAI,
    @Inject(ENV) private readonly env: Env,
  ) {}

  readonly embed = async (texts: string[]): Promise<number[][]> => {
    const vectors: number[][] = [];

    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE);
      const startedAt = Date.now();

      const response = await this.client.embeddings.create({
        model: this.env.EMBEDDING_MODEL,
        input: batch,
        ...(supportsDimensions(this.env.EMBEDDING_MODEL)
          ? { dimensions: EMBEDDING_DIMENSIONS }
          : {}),
      });

      const elapsed = Date.now() - startedAt;
      if (elapsed >= SLOW_BATCH_MS) {
        this.logger.warn(
          `Embedding ${batch.length} đoạn mất ${Math.round(elapsed / 1000)}s tại ${this.env.EMBEDDING_BASE_URL} — nhà cung cấp đang là nút thắt`,
        );
      }

      for (const item of response.data) {
        if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Model embedding trả vector ${item.embedding.length} chiều, cột vector cần ${EMBEDDING_DIMENSIONS}`,
          );
        }

        vectors.push(item.embedding);
      }
    }

    return vectors;
  };

  readonly embedOne = async (text: string): Promise<number[]> => {
    const [vector] = await this.embed([text]);
    if (vector === undefined) throw new Error('Không tạo được embedding');

    return vector;
  };
}
