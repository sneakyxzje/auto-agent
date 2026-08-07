import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { CitationValidator } from '../src/chat/citation-parser';
import { scopeFor } from '../src/knowledge/search/scope';
import { createEvalContext, handleOf, runAsTenant } from './eval-context';

const preview = (text: string, length: number): string =>
  text.replace(/\s+/g, ' ').slice(0, length);

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      question: { type: 'string' },
      tenant: { type: 'string' },
    },
  });

  const question = values.question;
  if (question === undefined) {
    throw new Error(
      'Thieu --question. Vi du: pnpm --filter @chatbot/api eval:trace --question "phi quan ly booking la bao nhieu"',
    );
  }

  const ctx = await createEvalContext(values.tenant);

  try {
    const config = await runAsTenant(ctx.tenantId, () => ctx.settings.load());

    const stats = await runAsTenant(ctx.tenantId, () =>
      ctx.tenantDb.run(async (tx) => {
        const rows = await tx.execute<{
          documents: string;
          chunks: string;
          chunks_from_images: string;
          embedded: string;
        }>(sql`
          SELECT
            (SELECT count(*) FROM documents WHERE status = 'published') AS documents,
            (SELECT count(*) FROM chunks WHERE doc_status = 'published') AS chunks,
            (SELECT count(*) FROM chunks WHERE doc_status = 'published'
               AND content LIKE '%[Ảnh:%') AS chunks_from_images,
            (SELECT count(*) FROM chunks WHERE doc_status = 'published'
               AND embedding IS NOT NULL) AS embedded
        `);
        return rows.rows[0];
      }),
    );

    console.log('=== KHO TRI THUC ===');
    console.log(`  tai lieu published : ${stats?.documents}`);
    console.log(`  doan (chunk)       : ${stats?.chunks}`);
    console.log(`  doan co vector     : ${stats?.embedded}`);
    console.log(`  doan chua chu OCR  : ${stats?.chunks_from_images}`);

    console.log('\n=== [0] VIET LAI TRUY VAN ===');
    console.log('  Bo qua: luot dau tien khong co lich su de giai tham chieu.');
    console.log(`  Truy van: ${question}`);

    console.log('\n=== [1] TIM KIEM LAI (vector + tu khoa, hop nhat RRF) ===');
    const searchStartedAt = Date.now();
    const retrieved = await runAsTenant(ctx.tenantId, () =>
      ctx.search.search(question, scopeFor(false, null), {
        topK: config.retrievalTopK,
        minScore: config.minRetrievalScore,
      }),
    );
    console.log(
      `  ${retrieved.length} doan trong ${Date.now() - searchStartedAt}ms (gom ca thoi gian embed cau hoi)`,
    );

    for (const chunk of retrieved.slice(0, 8)) {
      console.log(
        `  #${chunk.rank} ${handleOf(chunk.chunkId)} score=${chunk.score.toFixed(4)} [${chunk.documentTitle}]`,
      );
      console.log(`      ${preview(chunk.content, 110)}`);
    }

    if (retrieved.length === 0) {
      console.log('  Khong tim thay doan nao — dung tai day, se escalate.');
      return;
    }

    console.log('\n=== [2] GAC CONG (model nho doc 12 doan tot nhat) ===');
    const gateStartedAt = Date.now();
    const candidates = retrieved.map((chunk) => ({
      handle: handleOf(chunk.chunkId),
      chunk,
    }));
    const gate = await ctx.gate.evaluate(config, question, candidates);
    console.log(`  du can cu de tra loi : ${gate.enoughToAnswer}`);
    console.log(
      `  doan duoc chon       : ${gate.relevantHandles.join(', ') || '(khong co)'}`,
    );
    console.log(
      `  ${Date.now() - gateStartedAt}ms, token: ${gate.usage.input} vao / ${gate.usage.output} ra`,
    );

    if (!gate.enoughToAnswer) {
      console.log('\n=== KET QUA ===');
      console.log('  Bot se TU CHOI va mo phieu chuyen cho nguoi phu trach.');
      return;
    }

    const selected = candidates.filter((candidate) =>
      gate.relevantHandles.includes(candidate.handle),
    );

    console.log('\n=== [3] SINH CAU TRA LOI (model lon) ===');
    const documents = selected
      .map(
        ({ handle, chunk }) =>
          `[${handle}] (${chunk.departmentName} — ${chunk.documentTitle})\n${chunk.content}`,
      )
      .join('\n\n---\n\n');

    const validator = new CitationValidator(
      new Set(selected.map((candidate) => candidate.handle)),
    );

    const answerStartedAt = Date.now();
    let firstTokenMs: number | undefined;
    let answer = '';
    let invalid = 0;

    const stream = ctx.llm.stream({
      model: config.modelBig,
      system: config.promptAnswer,
      history: [],
      user: `TÀI LIỆU\n${documents}\n\nCÂU HỎI\n${question}`,
    });

    for await (const part of stream) {
      if (part.type === 'usage') continue;
      firstTokenMs ??= Date.now() - answerStartedAt;

      for (const event of validator.push(part.text)) {
        if (event.type === 'invalid') invalid += 1;
        else answer += event.text;
      }
    }

    for (const event of validator.flush()) {
      if (event.type === 'text') answer += event.text;
    }

    console.log(`  chu dau tien sau ${firstTokenMs}ms\n`);
    console.log(answer);

    console.log('\n=== [4] SOAT TRICH DAN (code, khong phai AI) ===');
    const cited = validator.citedHandles();
    console.log(`  marker hop le : ${cited.length} (${cited.join(', ')})`);
    console.log(`  marker bia    : ${invalid}`);
    console.log(
      invalid > 0
        ? '  => Cau tra loi se bi THU HOI va chuyen nguoi phu trach.'
        : cited.length === 0
          ? '  => Giu cau tra loi nhung gan nhan chua xac minh duoc nguon.'
          : '  => Cau tra loi hop le, hien thi kem nguon.',
    );
  } finally {
    await ctx.close();
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
