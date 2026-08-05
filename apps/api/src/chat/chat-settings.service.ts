import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { chatSettings } from '../db/schema/chat-settings';
import { TenantDb } from '../db/tenant-db.service';
import {
  CHAT_DEFAULTS,
  DEFAULT_ANSWER_PROMPT,
  DEFAULT_GATE_PROMPT,
  DEFAULT_REWRITE_PROMPT,
} from './chat-defaults';

export type ChatConfig = {
  retrievalTopK: number;
  gateTopK: number;
  gateChunkChars: number;
  minRetrievalScore: number;
  contextTurns: number;
  escalationSlaHours: number;
  rateLimitEmployeePerHour: number;
  rateLimitExternalPerHour: number;
  modelBig: string;
  modelSmall: string;
  promptRewrite: string;
  promptGate: string;
  promptAnswer: string;
};

@Injectable()
export class ChatSettingsService {
  constructor(
    private readonly tenantDb: TenantDb,
    @Inject(ENV) private readonly env: Env,
  ) {}

  readonly load = async (): Promise<ChatConfig> =>
    this.tenantDb.run(async (tx, tenantId) => {
      const rows = await tx
        .select()
        .from(chatSettings)
        .where(eq(chatSettings.tenantId, tenantId))
        .limit(1);

      const row = rows[0];

      return {
        retrievalTopK: row?.retrievalTopK ?? CHAT_DEFAULTS.retrievalTopK,
        gateTopK: row?.gateTopK ?? CHAT_DEFAULTS.gateTopK,
        gateChunkChars: row?.gateChunkChars ?? CHAT_DEFAULTS.gateChunkChars,
        minRetrievalScore:
          row?.minRetrievalScore === null ||
          row?.minRetrievalScore === undefined
            ? CHAT_DEFAULTS.minRetrievalScore
            : Number(row.minRetrievalScore),
        contextTurns: row?.contextTurns ?? CHAT_DEFAULTS.contextTurns,
        escalationSlaHours:
          row?.escalationSlaHours ?? CHAT_DEFAULTS.escalationSlaHours,
        rateLimitEmployeePerHour:
          row?.rateLimitEmployeePerHour ??
          CHAT_DEFAULTS.rateLimitEmployeePerHour,
        rateLimitExternalPerHour:
          row?.rateLimitExternalPerHour ??
          CHAT_DEFAULTS.rateLimitExternalPerHour,
        modelBig: row?.modelBig ?? this.env.LLM_MODEL_BIG,
        modelSmall: row?.modelSmall ?? this.env.LLM_MODEL_SMALL,
        promptRewrite: row?.promptRewrite ?? DEFAULT_REWRITE_PROMPT,
        promptGate: row?.promptGate ?? DEFAULT_GATE_PROMPT,
        promptAnswer: row?.promptAnswer ?? DEFAULT_ANSWER_PROMPT,
      };
    });
}
