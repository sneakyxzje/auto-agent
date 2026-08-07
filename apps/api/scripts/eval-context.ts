import 'reflect-metadata';
import { drizzle } from 'drizzle-orm/node-postgres';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { ChatSettingsService } from '../src/chat/chat-settings.service';
import { GateService } from '../src/chat/gate.service';
import { type Env, loadEnv } from '../src/config/env';
import {
  enterRequestContext,
  fillRequestContext,
} from '../src/core/context/request-context';
import type { Database } from '../src/db/database.tokens';
import * as schema from '../src/db/schema';
import { TenantDb } from '../src/db/tenant-db.service';
import { SearchService } from '../src/knowledge/search/search.service';
import { EmbeddingService } from '../src/llm/embedding.service';
import { LlmService } from '../src/llm/llm.service';

export type EvalCategory =
  | 'direct'
  | 'paraphrase'
  | 'deep'
  | 'synthesis'
  | 'trap';

export type EvalQuestion = {
  id: string;
  category: EvalCategory;
  question: string;
  expectAnswer: boolean;
  documentId: string;
  documentTitle: string;
  requiredChunkIds: string[];
  /** Neo theo nội dung — sống sót qua re-index, khác với chunk id. */
  requiredSnippets?: string[];
};

export type EvalSet = {
  generatedAt: string;
  tenantId: string;
  generatorModel: string;
  questions: EvalQuestion[];
};

export type EvalContext = {
  env: Env;
  db: Database;
  tenantDb: TenantDb;
  llm: LlmService;
  search: SearchService;
  gate: GateService;
  settings: ChatSettingsService;
  tenantId: string;
  close: () => Promise<void>;
};

export const handleOf = (chunkId: string): string => `c_${chunkId.slice(0, 8)}`;

const resolveTenantId = async (
  env: Env,
  requested: string | undefined,
): Promise<string> => {
  const owner = new Pool({
    connectionString: env.DATABASE_MIGRATION_URL,
    max: 1,
  });

  try {
    const { rows } = await owner.query<{
      id: string;
      slug: string;
      docs: string;
    }>(
      `SELECT t.id, t.slug, count(d.id) AS docs
       FROM tenants t
       LEFT JOIN documents d ON d.tenant_id = t.id AND d.status = 'published'
       GROUP BY t.id, t.slug
       ORDER BY count(d.id) DESC, t.created_at`,
    );

    if (rows.length === 0) throw new Error('DB chua co tenant nao');

    if (requested !== undefined) {
      const found = rows.find(
        (row) => row.id === requested || row.slug === requested,
      );
      if (found === undefined) {
        throw new Error(`Khong tim thay tenant "${requested}"`);
      }
      return found.id;
    }

    const withDocs = rows.filter((row) => Number(row.docs) > 0);
    const first = withDocs[0];

    if (withDocs.length !== 1 || first === undefined) {
      const listing = withDocs
        .map((row) => `  ${row.slug}  ${row.id}  (${row.docs} tai lieu)`)
        .join('\n');
      throw new Error(
        withDocs.length === 0
          ? 'Khong tenant nao co tai lieu published'
          : `Co ${withDocs.length} tenant co tai lieu, chon bang --tenant <slug|id>:\n${listing}`,
      );
    }

    console.log(`Dung tenant ${first.slug} (${first.docs} tai lieu published)`);
    return first.id;
  } finally {
    await owner.end();
  }
};

export const createEvalContext = async (
  requestedTenant: string | undefined,
): Promise<EvalContext> => {
  const env = loadEnv();
  const tenantId = await resolveTenantId(env, requestedTenant);

  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  const db: Database = drizzle(pool, { schema });
  const tenantDb = new TenantDb(db);

  const chatClient = new OpenAI({
    apiKey: env.LLM_API_KEY.length > 0 ? env.LLM_API_KEY : 'not-needed',
    baseURL: env.LLM_BASE_URL,
  });
  const embeddingClient = new OpenAI({
    apiKey:
      env.EMBEDDING_API_KEY.length > 0 ? env.EMBEDDING_API_KEY : 'not-needed',
    baseURL: env.EMBEDDING_BASE_URL,
  });

  const llm = new LlmService(chatClient);
  const embedding = new EmbeddingService(embeddingClient, env);
  const search = new SearchService(tenantDb, embedding);
  const gate = new GateService(llm);
  const settings = new ChatSettingsService(tenantDb, env);

  return {
    env,
    db,
    tenantDb,
    llm,
    search,
    gate,
    settings,
    tenantId,
    close: async () => {
      await pool.end();
    },
  };
};

export const runAsTenant = async <T>(
  tenantId: string,
  work: () => Promise<T>,
): Promise<T> =>
  enterRequestContext(() => {
    fillRequestContext({ tenantId, isExternal: false });
    return work();
  });
