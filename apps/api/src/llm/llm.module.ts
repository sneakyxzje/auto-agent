import { Global, Module } from '@nestjs/common';
import OpenAI from 'openai';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { EmbeddingService } from './embedding.service';
import { LlmService } from './llm.service';
import { CHAT_CLIENT, EMBEDDING_CLIENT } from './llm.tokens';

/**
 * Hai client riêng vì hai dịch vụ có thể nằm ở hai nơi: brief cho phép đổi sang
 * Ollama/vLLM hoặc TEI self-host chỉ bằng cách sửa base URL, không đụng code.
 */
@Global()
@Module({
  providers: [
    {
      provide: CHAT_CLIENT,
      useFactory: (env: Env): OpenAI =>
        new OpenAI({
          apiKey: env.LLM_API_KEY.length > 0 ? env.LLM_API_KEY : 'not-needed',
          baseURL: env.LLM_BASE_URL,
        }),
      inject: [ENV],
    },
    {
      provide: EMBEDDING_CLIENT,
      useFactory: (env: Env): OpenAI =>
        new OpenAI({
          apiKey:
            env.EMBEDDING_API_KEY.length > 0
              ? env.EMBEDDING_API_KEY
              : 'not-needed',
          baseURL: env.EMBEDDING_BASE_URL,
        }),
      inject: [ENV],
    },
    LlmService,
    EmbeddingService,
  ],
  exports: [LlmService, EmbeddingService],
})
export class LlmModule {}
