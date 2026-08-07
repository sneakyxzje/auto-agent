import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { asc, eq } from 'drizzle-orm';
import type { ChatConfig } from '../src/chat/chat-settings.service';
import { chunks } from '../src/db/schema/chunk';
import { documents } from '../src/db/schema/document';
import { scopeFor } from '../src/knowledge/search/scope';
import {
  createEvalContext,
  type EvalContext,
  type EvalQuestion,
  type EvalSet,
  runAsTenant,
} from './eval-context';

type Piece = { id: string; ord: number; content: string };
type DocWithChunks = { id: string; title: string; pieces: Piece[] };

const SUBSTANTIAL_CHARS = 400;
const DEEP_MIN_CHARS = 1600;
const GATE_CUT_CHARS = 1200;
const TRAPS_PER_DOC = 2;

const QUESTION_SCHEMA = {
  type: 'object',
  properties: { question: { type: 'string' } },
  required: ['question'],
  additionalProperties: false,
};

const parseQuestion = (value: unknown): string => {
  const raw = value as { question?: unknown };
  return typeof raw.question === 'string' ? raw.question.trim() : '';
};

const TRAPS_SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
  additionalProperties: false,
};

const parseTraps = (value: unknown): string[] => {
  const raw = value as { questions?: unknown };
  return Array.isArray(raw.questions)
    ? raw.questions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
};

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { answerable: { type: 'boolean' } },
  required: ['answerable'],
  additionalProperties: false,
};

const parseVerdict = (value: unknown): boolean =>
  (value as { answerable?: unknown }).answerable === true;

const DIRECT_SYSTEM = `Bạn tạo câu hỏi kiểm thử cho hệ thống hỏi–đáp nội bộ.
Cho một đoạn tài liệu, hãy viết đúng MỘT câu hỏi tiếng Việt mà nhân viên sẽ hỏi, sao cho:
- Câu trả lời được nêu trực tiếp trong đoạn.
- Dùng đúng từ ngữ, thuật ngữ xuất hiện trong đoạn.
- Câu hỏi đứng một mình vẫn đủ nghĩa.`;

const PARAPHRASE_SYSTEM = `Bạn tạo câu hỏi kiểm thử cho hệ thống hỏi–đáp nội bộ.
Cho một đoạn tài liệu, hãy viết đúng MỘT câu hỏi tiếng Việt sao cho:
- Câu trả lời được nêu trực tiếp trong đoạn.
- TRÁNH dùng các từ khóa chính của đoạn: thay bằng từ đồng nghĩa hoặc cách nói đời thường mà nhân viên hay dùng (ví dụ tài liệu viết "thai sản" thì hỏi "nghỉ đẻ").
- Câu hỏi đứng một mình vẫn đủ nghĩa.`;

const DEEP_SYSTEM = `Bạn tạo câu hỏi kiểm thử cho hệ thống hỏi–đáp nội bộ.
Cho một phần trích từ giữa tài liệu, hãy viết đúng MỘT câu hỏi tiếng Việt sao cho:
- Câu trả lời nằm trong phần trích này.
- Câu hỏi đứng một mình vẫn đủ nghĩa, người chưa đọc tài liệu vẫn hiểu đang hỏi về điều gì.`;

const SYNTHESIS_SYSTEM = `Bạn tạo câu hỏi kiểm thử cho hệ thống hỏi–đáp nội bộ.
Cho HAI đoạn từ cùng một tài liệu, hãy viết đúng MỘT câu hỏi tiếng Việt sao cho:
- Muốn trả lời ĐẦY ĐỦ phải ghép dữ kiện từ CẢ HAI đoạn; mỗi đoạn riêng lẻ chỉ trả lời được một phần.
- Không đòi hỏi suy luận hay ước lượng ngoài những gì hai đoạn nêu rõ.
- Câu hỏi đứng một mình vẫn đủ nghĩa.`;

const TRAP_SYSTEM = `Bạn tạo câu hỏi "bẫy" cho hệ thống hỏi–đáp nội bộ: câu hỏi CÙNG chủ đề với tài liệu nhưng tài liệu KHÔNG chứa câu trả lời.
Cho tiêu đề và dàn ý tài liệu, hãy viết ${TRAPS_PER_DOC} câu hỏi tiếng Việt mà:
- Nghe rất tự nhiên, đúng chủ đề của tài liệu.
- Nhưng dữ kiện để trả lời KHÔNG có trong tài liệu (hỏi về mốc, trường hợp, chi tiết mà dàn ý không nhắc tới).
- KHÔNG hỏi dạng đếm ("có bao nhiêu...") hay hỏi về chính tài liệu ("tài liệu đề cập...") — những câu đó đếm được từ nội dung nên không phải bẫy.
- Câu hỏi phải rõ nghĩa một cách duy nhất, không có cách diễn giải nào khiến nó trả lời được từ tài liệu.
- Một bot trung thực sẽ phải từ chối trả lời các câu này.`;

const TRAP_VERIFY_SYSTEM = `Bạn kiểm tra một câu hỏi "bẫy". Cho câu hỏi và các đoạn tài liệu tìm được, trả về answerable = true nếu các đoạn CHỨA đủ dữ kiện để trả lời trực tiếp câu hỏi, ngược lại trả về false. Chỉ xét chữ nghĩa trong các đoạn, không dùng kiến thức bên ngoài.`;

const pickSpread = <T>(items: T[], count: number): T[] => {
  if (items.length <= count) return items;

  const step = items.length / count;
  const picked: T[] = [];

  for (let index = 0; index < count; index += 1) {
    const item = items[Math.floor(index * step)];
    if (item !== undefined) picked.push(item);
  }

  return picked;
};

const loadDocuments = async (
  ctx: EvalContext,
  limit: number | null,
): Promise<DocWithChunks[]> =>
  runAsTenant(ctx.tenantId, () =>
    ctx.tenantDb.run(async (tx) => {
      const docs = await tx
        .select({ id: documents.id, title: documents.title })
        .from(documents)
        .where(eq(documents.status, 'published'))
        .orderBy(asc(documents.createdAt));

      const chosen = limit === null ? docs : docs.slice(0, limit);
      const loaded: DocWithChunks[] = [];

      for (const doc of chosen) {
        const pieces = await tx
          .select({ id: chunks.id, ord: chunks.ord, content: chunks.content })
          .from(chunks)
          .where(eq(chunks.documentId, doc.id))
          .orderBy(asc(chunks.ord));

        loaded.push({ id: doc.id, title: doc.title, pieces });
      }

      return loaded;
    }),
  );

const generateQuestion = async (
  ctx: EvalContext,
  config: ChatConfig,
  system: string,
  user: string,
): Promise<string> => {
  const { value } = await ctx.llm.structured({
    model: config.modelSmall,
    system,
    user,
    schemaName: 'eval_question',
    jsonSchema: QUESTION_SCHEMA,
    parse: parseQuestion,
    maxOutputTokens: 200,
  });

  return value;
};

const generateTraps = async (
  ctx: EvalContext,
  config: ChatConfig,
  doc: DocWithChunks,
): Promise<string[]> => {
  const outline = doc.pieces
    .slice(0, 40)
    .map((piece) => {
      const firstLine = piece.content.split('\n')[0] ?? '';
      return `- ${firstLine.slice(0, 120)}`;
    })
    .join('\n');

  const { value } = await ctx.llm.structured({
    model: config.modelSmall,
    system: TRAP_SYSTEM,
    user: `TIÊU ĐỀ TÀI LIỆU\n${doc.title}\n\nDÀN Ý\n${outline}`,
    schemaName: 'eval_traps',
    jsonSchema: TRAPS_SCHEMA,
    parse: parseTraps,
    maxOutputTokens: 400,
  });

  return value.slice(0, TRAPS_PER_DOC);
};

const isRealTrap = async (
  ctx: EvalContext,
  config: ChatConfig,
  question: string,
): Promise<boolean> => {
  const found = await runAsTenant(ctx.tenantId, () =>
    ctx.search.search(question, scopeFor(false, null), {
      topK: 8,
      minScore: config.minRetrievalScore,
    }),
  );

  if (found.length === 0) return true;

  const listed = found
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n---\n\n');

  const { value } = await ctx.llm.structured({
    model: config.modelSmall,
    system: TRAP_VERIFY_SYSTEM,
    user: `CÂU HỎI\n${question}\n\nCÁC ĐOẠN\n${listed}`,
    schemaName: 'trap_verdict',
    jsonSchema: VERDICT_SCHEMA,
    parse: parseVerdict,
    maxOutputTokens: 20,
  });

  return !value;
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      tenant: { type: 'string' },
      limit: { type: 'string' },
      out: { type: 'string' },
    },
  });

  const ctx = await createEvalContext(values.tenant);

  try {
    const config = await runAsTenant(ctx.tenantId, () => ctx.settings.load());
    const limit = values.limit === undefined ? null : Number(values.limit);
    const docs = await loadDocuments(ctx, limit);

    if (docs.length === 0) {
      throw new Error('Khong co tai lieu published nao trong DB');
    }

    console.log(`Sinh cau hoi tu ${docs.length} tai lieu...`);

    const questions: EvalQuestion[] = [];
    const seen = new Set<string>();
    let counter = 0;

    const add = (
      category: EvalQuestion['category'],
      question: string,
      doc: DocWithChunks,
      requiredChunkIds: string[],
    ): void => {
      const key = question.toLowerCase().replace(/\s+/g, ' ').trim();
      if (question.length === 0 || seen.has(key)) return;

      seen.add(key);
      counter += 1;
      questions.push({
        id: `q${String(counter).padStart(3, '0')}-${category}`,
        category,
        question,
        expectAnswer: category !== 'trap',
        documentId: doc.id,
        documentTitle: doc.title,
        requiredChunkIds,
      });
    };

    const pendingTraps: { doc: DocWithChunks; question: string }[] = [];

    for (const doc of docs) {
      console.log(`  ${doc.title} (${doc.pieces.length} chunk)`);

      const substantial = doc.pieces.filter(
        (piece) => piece.content.length >= SUBSTANTIAL_CHARS,
      );

      for (const piece of pickSpread(substantial, 2)) {
        const question = await generateQuestion(
          ctx,
          config,
          DIRECT_SYSTEM,
          `TIÊU ĐỀ TÀI LIỆU\n${doc.title}\n\nĐOẠN TÀI LIỆU\n${piece.content.slice(0, 2400)}`,
        );
        add('direct', question, doc, [piece.id]);
      }

      for (const piece of pickSpread(substantial, 2)) {
        const question = await generateQuestion(
          ctx,
          config,
          PARAPHRASE_SYSTEM,
          `TIÊU ĐỀ TÀI LIỆU\n${doc.title}\n\nĐOẠN TÀI LIỆU\n${piece.content.slice(0, 2400)}`,
        );
        add('paraphrase', question, doc, [piece.id]);
      }

      const longPieces = doc.pieces.filter(
        (piece) => piece.content.length >= DEEP_MIN_CHARS,
      );
      const deepPiece = pickSpread(longPieces, 1)[0];
      if (deepPiece !== undefined) {
        const question = await generateQuestion(
          ctx,
          config,
          DEEP_SYSTEM,
          `TIÊU ĐỀ TÀI LIỆU\n${doc.title}\n\nPHẦN TRÍCH TỪ GIỮA TÀI LIỆU\n${deepPiece.content.slice(GATE_CUT_CHARS, GATE_CUT_CHARS + 2400)}`,
        );
        add('deep', question, doc, [deepPiece.id]);
      }

      if (substantial.length >= 3) {
        const first = substantial[0];
        const last = substantial[substantial.length - 1];
        if (
          first !== undefined &&
          last !== undefined &&
          last.ord - first.ord >= 2
        ) {
          const question = await generateQuestion(
            ctx,
            config,
            SYNTHESIS_SYSTEM,
            `TIÊU ĐỀ TÀI LIỆU\n${doc.title}\n\nĐOẠN MỘT\n${first.content.slice(0, 2000)}\n\nĐOẠN HAI\n${last.content.slice(0, 2000)}`,
          );
          add('synthesis', question, doc, [first.id, last.id]);
        }
      }

      for (const trap of await generateTraps(ctx, config, doc)) {
        pendingTraps.push({ doc, question: trap });
      }
    }

    console.log(`Kiem chung ${pendingTraps.length} cau bay...`);
    let dropped = 0;

    for (const { doc, question } of pendingTraps) {
      if (await isRealTrap(ctx, config, question)) {
        add('trap', question, doc, []);
      } else {
        dropped += 1;
        console.log(`  LOAI (kho tra loi duoc): ${question}`);
      }
    }

    const evalSet: EvalSet = {
      generatedAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      generatorModel: config.modelSmall,
      questions,
    };

    const outFile =
      values.out ?? join(__dirname, '..', 'eval', 'eval-set.json');
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, `${JSON.stringify(evalSet, null, 2)}\n`, 'utf8');

    const byCategory = new Map<string, number>();
    for (const question of questions) {
      byCategory.set(
        question.category,
        (byCategory.get(question.category) ?? 0) + 1,
      );
    }

    console.log(`\nDa ghi ${questions.length} cau hoi vao ${outFile}`);
    for (const [category, count] of byCategory) {
      console.log(`  ${category}: ${count}`);
    }
    if (dropped > 0) console.log(`  bay bi loai: ${dropped}`);

    const traps = questions.filter((question) => question.category === 'trap');
    if (traps.length > 0) {
      console.log('\nCAC CAU BAY - nen liec qua truoc khi chay diagnose:');
      for (const trap of traps) {
        console.log(`  [${trap.id}] ${trap.question}`);
      }
    }
  } finally {
    await ctx.close();
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
