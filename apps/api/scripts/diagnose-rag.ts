import 'reflect-metadata';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ChatConfig } from '../src/chat/chat-settings.service';
import { scopeFor } from '../src/knowledge/search/scope';
import type { RetrievedChunk } from '../src/knowledge/search/search.service';
import { addUsage, emptyUsage, type TokenUsage } from '../src/llm/llm.tokens';
import {
  createEvalContext,
  type EvalQuestion,
  type EvalSet,
  handleOf,
  runAsTenant,
} from './eval-context';

type VariantKey = 'V0' | 'V1' | 'V2' | 'V1V2';

type GateVerdict = { enough: boolean; relevantHandles: string[] };

type Classification =
  | 'pass'
  | 'retrieval'
  | 'ranking'
  | 'truncation'
  | 'gate'
  | 'gate-truncation'
  | 'unrescued'
  | 'trap-safe'
  | 'trap-leaked';

type Trace = {
  id: string;
  category: EvalQuestion['category'];
  question: string;
  expectAnswer: boolean;
  requiredChunkIds: string[];
  requiredRanks: Record<string, number | null>;
  top: {
    chunkId: string;
    documentTitle: string;
    rank: number;
    score: number;
  }[];
  verdicts: Partial<Record<VariantKey, GateVerdict>>;
  altQuery: string | null;
  fusedRequiredRanks: Record<string, number | null> | null;
  multiQueryRescued: boolean | null;
  classification: Classification;
};

const RRF_K = 60;

const RELAXED_GATE_PROMPT = `Bạn lọc đoạn tài liệu cho một hệ thống chỉ được phép trả lời dựa trên tài liệu nội bộ.

Cho một câu hỏi và danh sách đoạn tài liệu, hãy trả về:
- relevant_chunk_ids: mã của những đoạn chứa dữ kiện dùng được để trả lời câu hỏi này.
- enough_to_answer: đặt true khi câu trả lời rút ra TRỰC TIẾP được từ các dữ kiện NÊU RÕ trong các đoạn — kể cả khi phải ghép dữ kiện từ nhiều đoạn, hoặc khi tài liệu dùng từ ngữ khác với câu hỏi nhưng cùng nghĩa.

Vẫn đặt false khi:
- Thiếu dữ kiện then chốt để trả lời trọn vẹn.
- Phải ngoại suy con số, mốc, hay quy định không được nêu (tài liệu chỉ có mốc 30 phút thì KHÔNG suy ra mốc 1 tiếng).
- Phải dùng kiến thức bên ngoài các đoạn tài liệu.

Nguyên tắc: mọi dữ kiện trong câu trả lời phải có mặt trong các đoạn — không bịa, không đoán.`;

const ALT_SCHEMA = {
  type: 'object',
  properties: { alternative: { type: 'string' } },
  required: ['alternative'],
  additionalProperties: false,
};

const parseAlt = (value: unknown): string => {
  const raw = value as { alternative?: unknown };
  return typeof raw.alternative === 'string' ? raw.alternative.trim() : '';
};

const ALT_SYSTEM = `Bạn diễn đạt lại câu hỏi cho một hệ thống tìm kiếm tài liệu nội bộ.
Viết lại câu hỏi bằng từ ngữ khác hẳn: dùng từ đồng nghĩa; nếu câu gốc dùng từ đời thường thì đổi sang thuật ngữ hành chính, và ngược lại. Giữ nguyên ý, con số và tên riêng. Chỉ trả về đúng một câu hỏi.`;

const GATE_LABELS: Record<string, string> = {
  retrieval: 'Cửa [2] — đoạn cần thiết không vào top-20',
  ranking: 'Cửa [3] — vào top-20 nhưng rớt khỏi top-12 đưa vào gate',
  truncation: 'Cửa [4] — gate bị cắt gateChunkChars nên không thấy đáp án',
  gate: 'Cửa [5] — gate thấy đủ chữ nhưng prompt quá chặt',
  'gate-truncation': 'Cửa [4]+[5] — phải vừa bỏ cắt vừa nới prompt',
  unrescued: 'Không biến thể nào cứu được — cần xem tay',
};

const REMEDIES: Record<string, string> = {
  retrieval: 'Multi-query / contextual chunk (xem tỷ lệ V3 cứu được)',
  ranking: 'Tăng gateTopK hoặc thêm rerank',
  truncation: 'Tăng gateChunkChars',
  gate: 'Nới gate prompt (giữ cấm ngoại suy)',
  'gate-truncation': 'Tăng gateChunkChars + nới gate prompt',
  unrescued: 'Soi diagnosis-raw.json từng ca',
};

const variantConfig = (config: ChatConfig, key: VariantKey): ChatConfig => {
  if (key === 'V1') return { ...config, gateChunkChars: 1_000_000 };
  if (key === 'V2') return { ...config, promptGate: RELAXED_GATE_PROMPT };
  if (key === 'V1V2') {
    return {
      ...config,
      gateChunkChars: 1_000_000,
      promptGate: RELAXED_GATE_PROMPT,
    };
  }
  return config;
};

const fuse = (
  first: RetrievedChunk[],
  second: RetrievedChunk[],
  topK: number,
): RetrievedChunk[] => {
  const scores = new Map<string, { chunk: RetrievedChunk; score: number }>();

  const feed = (list: RetrievedChunk[]): void => {
    list.forEach((chunk, index) => {
      const gain = 1 / (RRF_K + index + 1);
      const existing = scores.get(chunk.chunkId);
      if (existing === undefined) {
        scores.set(chunk.chunkId, { chunk, score: gain });
      } else {
        existing.score += gain;
      }
    });
  };

  feed(first);
  feed(second);

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry, index) => ({
      ...entry.chunk,
      score: entry.score,
      rank: index + 1,
    }));
};

type Anchor = {
  key: string;
  matches: (chunk: RetrievedChunk) => boolean;
};

const anchorsOf = (question: EvalQuestion): Anchor[] => [
  ...question.requiredChunkIds.map((id) => ({
    key: handleOf(id),
    matches: (chunk: RetrievedChunk) => chunk.chunkId === id,
  })),
  ...(question.requiredSnippets ?? []).map((snippet) => ({
    key: `"${snippet.slice(0, 40)}"`,
    matches: (chunk: RetrievedChunk) =>
      chunk.content.toLowerCase().includes(snippet.toLowerCase()),
  })),
];

const rankMap = (
  anchors: Anchor[],
  retrieved: RetrievedChunk[],
): Map<string, number | null> => {
  const ranks = new Map<string, number | null>();
  for (const anchor of anchors) {
    const index = retrieved.findIndex((chunk) => anchor.matches(chunk));
    ranks.set(anchor.key, index === -1 ? null : index + 1);
  }
  return ranks;
};

const allWithin = (ranks: Map<string, number | null>, limit: number): boolean =>
  [...ranks.values()].every((rank) => rank !== null && rank <= limit);

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      tenant: { type: 'string' },
      in: { type: 'string' },
      'out-dir': { type: 'string' },
    },
  });

  const evalDir = values['out-dir'] ?? join(__dirname, '..', 'eval');
  const inFile = values.in ?? join(evalDir, 'eval-set.json');
  const evalSet = JSON.parse(readFileSync(inFile, 'utf8')) as EvalSet;

  const ctx = await createEvalContext(values.tenant ?? evalSet.tenantId);

  try {
    const config = await runAsTenant(ctx.tenantId, () => ctx.settings.load());
    let usage: TokenUsage = emptyUsage();

    const searchOnce = async (question: string): Promise<RetrievedChunk[]> =>
      runAsTenant(ctx.tenantId, () =>
        ctx.search.search(question, scopeFor(false, null), {
          topK: config.retrievalTopK,
          minScore: config.minRetrievalScore,
        }),
      );

    const runGate = async (
      key: VariantKey,
      question: string,
      retrieved: RetrievedChunk[],
    ): Promise<GateVerdict> => {
      if (retrieved.length === 0) {
        return { enough: false, relevantHandles: [] };
      }

      const candidates = retrieved.map((chunk) => ({
        handle: handleOf(chunk.chunkId),
        chunk,
      }));
      const result = await ctx.gate.evaluate(
        variantConfig(config, key),
        question,
        candidates,
      );
      usage = addUsage(usage, result.usage);

      return {
        enough: result.enoughToAnswer,
        relevantHandles: result.relevantHandles,
      };
    };

    const makeAltQuery = async (question: string): Promise<string> => {
      const { value, usage: altUsage } = await ctx.llm.structured({
        model: config.modelSmall,
        system: ALT_SYSTEM,
        user: question,
        schemaName: 'alt_query',
        jsonSchema: ALT_SCHEMA,
        parse: parseAlt,
        maxOutputTokens: 200,
      });
      usage = addUsage(usage, altUsage);
      return value;
    };

    const traces: Trace[] = [];
    const total = evalSet.questions.length;

    for (const [index, question] of evalSet.questions.entries()) {
      const retrieved = await searchOnce(question.question);
      const anchors = anchorsOf(question);
      const requiredRanks = rankMap(anchors, retrieved);
      const verdicts: Partial<Record<VariantKey, GateVerdict>> = {};

      let altQuery: string | null = null;
      let fusedRanks: Map<string, number | null> | null = null;
      let multiQueryRescued: boolean | null = null;
      let classification: Classification;

      if (!question.expectAnswer) {
        verdicts.V0 = await runGate('V0', question.question, retrieved);
        verdicts.V1 = await runGate('V1', question.question, retrieved);
        verdicts.V2 = await runGate('V2', question.question, retrieved);
        verdicts.V1V2 = await runGate('V1V2', question.question, retrieved);

        const leaked = Object.values(verdicts).some(
          (verdict) => verdict.enough,
        );
        classification = leaked ? 'trap-leaked' : 'trap-safe';
      } else {
        const hit20 = allWithin(requiredRanks, config.retrievalTopK);
        const hit12 = allWithin(requiredRanks, config.gateTopK);

        if (!hit12) {
          altQuery = await makeAltQuery(question.question);
          if (altQuery.length > 0) {
            const altRetrieved = await searchOnce(altQuery);
            const fused = fuse(retrieved, altRetrieved, config.retrievalTopK);
            fusedRanks = rankMap(anchors, fused);
            multiQueryRescued = allWithin(fusedRanks, config.gateTopK);
          } else {
            multiQueryRescued = false;
          }
        }

        if (!hit20) {
          classification = 'retrieval';
        } else if (!hit12) {
          classification = 'ranking';
        } else {
          verdicts.V0 = await runGate('V0', question.question, retrieved);

          if (verdicts.V0.enough) {
            classification = 'pass';
          } else {
            verdicts.V1 = await runGate('V1', question.question, retrieved);
            verdicts.V2 = await runGate('V2', question.question, retrieved);
            verdicts.V1V2 = await runGate('V1V2', question.question, retrieved);

            if (verdicts.V1.enough) classification = 'truncation';
            else if (verdicts.V2.enough) classification = 'gate';
            else if (verdicts.V1V2.enough) classification = 'gate-truncation';
            else classification = 'unrescued';
          }
        }
      }

      traces.push({
        id: question.id,
        category: question.category,
        question: question.question,
        expectAnswer: question.expectAnswer,
        requiredChunkIds: question.requiredChunkIds,
        requiredRanks: Object.fromEntries(requiredRanks),
        top: retrieved.map((chunk) => ({
          chunkId: chunk.chunkId,
          documentTitle: chunk.documentTitle,
          rank: chunk.rank,
          score: chunk.score,
        })),
        verdicts,
        altQuery,
        fusedRequiredRanks:
          fusedRanks === null ? null : Object.fromEntries(fusedRanks),
        multiQueryRescued,
        classification,
      });

      console.log(
        `[${index + 1}/${total}] ${question.id} -> ${classification}`,
      );
    }

    const answerable = traces.filter((trace) => trace.expectAnswer);
    const traps = traces.filter((trace) => !trace.expectAnswer);
    const failures = answerable.filter(
      (trace) => trace.classification !== 'pass',
    );
    const gateStage = answerable.filter(
      (trace) => trace.verdicts.V1 !== undefined,
    );
    const retrievalStage = answerable.filter(
      (trace) =>
        trace.classification === 'retrieval' ||
        trace.classification === 'ranking',
    );

    const countBy = (
      items: Trace[],
      pick: (trace: Trace) => string,
    ): Map<string, number> => {
      const counts = new Map<string, number>();
      for (const item of items) {
        counts.set(pick(item), (counts.get(pick(item)) ?? 0) + 1);
      }
      return counts;
    };

    const categories = ['direct', 'paraphrase', 'deep', 'synthesis', 'trap'];
    const categoryRows = categories
      .map((category) => {
        const inCategory = traces.filter(
          (trace) => trace.category === category,
        );
        if (inCategory.length === 0) return null;
        const ok = inCategory.filter(
          (trace) =>
            trace.classification === 'pass' ||
            trace.classification === 'trap-safe',
        ).length;
        return `| ${category} | ${inCategory.length} | ${ok} | ${inCategory.length - ok} |`;
      })
      .filter((row): row is string => row !== null)
      .join('\n');

    const failureCounts = countBy(failures, (trace) => trace.classification);
    const gateRows = [...failureCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => {
        const share = ((count / Math.max(failures.length, 1)) * 100).toFixed(0);
        return `| ${GATE_LABELS[key] ?? key} | ${count} | ${share}% | ${REMEDIES[key] ?? ''} |`;
      })
      .join('\n');

    const rescueRow = (key: VariantKey, pool: Trace[]): string => {
      const rescued = pool.filter(
        (trace) => trace.verdicts[key]?.enough === true,
      ).length;
      return `${rescued}/${pool.length}`;
    };

    const multiQueryPool = retrievalStage.filter(
      (trace) => trace.multiQueryRescued !== null,
    );
    const multiQueryRescuedCount = multiQueryPool.filter(
      (trace) => trace.multiQueryRescued === true,
    ).length;

    const trapLeaks = (key: VariantKey): Trace[] =>
      traps.filter((trace) => trace.verdicts[key]?.enough === true);

    const trapRows = (['V0', 'V1', 'V2', 'V1V2'] as VariantKey[])
      .map((key) => {
        const leaks = trapLeaks(key);
        const status = leaks.length === 0 ? 'AN TOÀN' : 'KHÔNG AN TOÀN';
        return `| ${key} | ${leaks.length}/${traps.length} | ${status} |`;
      })
      .join('\n');

    const leakedDetails = traps
      .filter((trace) => trace.classification === 'trap-leaked')
      .map((trace) => {
        const leakedIn = (
          Object.entries(trace.verdicts) as [VariantKey, GateVerdict][]
        )
          .filter(([, verdict]) => verdict.enough)
          .map(([key]) => key)
          .join(', ');
        return `- \`${trace.id}\` lọt ở ${leakedIn}: ${trace.question}`;
      })
      .join('\n');

    const failureDetails = failures
      .map((trace) => {
        const ranks = Object.entries(trace.requiredRanks)
          .map(([key, rank]) => `${key}=${rank ?? 'ngoài top-20'}`)
          .join(', ');
        const fusedNote =
          trace.multiQueryRescued === null
            ? ''
            : trace.multiQueryRescued
              ? ` — multi-query CỨU ĐƯỢC (câu thay thế: "${trace.altQuery ?? ''}")`
              : ' — multi-query không cứu được';
        return `- \`${trace.id}\` [${trace.category}] → **${trace.classification}** (rank đoạn cần: ${ranks})${fusedNote}\n  "${trace.question}"`;
      })
      .join('\n');

    const passCount = answerable.length - failures.length;
    const report = `# Báo cáo chẩn đoán RAG

- Ngày chạy: ${new Date().toISOString()}
- Tenant: ${ctx.tenantId}
- Bộ câu hỏi: ${inFile} (${total} câu, sinh lúc ${evalSet.generatedAt})
- Config: retrievalTopK=${config.retrievalTopK}, gateTopK=${config.gateTopK}, gateChunkChars=${config.gateChunkChars}, modelSmall=${config.modelSmall}
- Token đã dùng cho chẩn đoán: input=${usage.input}, output=${usage.output}

## Tổng quan theo loại câu hỏi

| Loại | Tổng | Đạt | Trượt |
|---|---|---|---|
${categoryRows}

Câu kỳ vọng trả lời được: **${passCount}/${answerable.length} PASS ở cấu hình hiện tại (V0)**.

## Câu trượt chết ở cửa nào

| Cửa | Số câu | % số câu trượt | Thuốc đề xuất |
|---|---|---|---|
${gateRows.length > 0 ? gateRows : '| (không có câu trượt) | 0 | — | — |'}

## Hiệu quả từng biến thể

- **V1 — gate nhìn nguyên văn chunk (bỏ cắt 1200 ký tự):** cứu ${rescueRow('V1', gateStage)} ca V0 từ chối ở bước gate.
- **V2 — gate prompt nới (cho phép ghép dữ kiện đã nêu, vẫn cấm ngoại suy):** cứu ${rescueRow('V2', gateStage)} ca V0 từ chối ở bước gate.
- **V1+V2 kết hợp:** cứu ${rescueRow('V1V2', gateStage)}.
- **V3 — multi-query (tìm thêm bằng câu diễn đạt khác, hợp nhất RRF):** đưa đủ đoạn cần thiết vào top-${config.gateTopK} ở ${multiQueryRescuedCount}/${multiQueryPool.length} ca trượt retrieval/xếp hạng.

## An toàn câu bẫy (${traps.length} câu — bắt buộc 0 lọt)

| Biến thể | Số bẫy lọt | Kết luận |
|---|---|---|
${trapRows}

${leakedDetails.length > 0 ? `Các bẫy bị lọt:\n${leakedDetails}` : 'Không câu bẫy nào bị trả lời ở bất kỳ biến thể nào.'}

## Chi tiết các câu trượt

${failureDetails.length > 0 ? failureDetails : 'Không có.'}

## Giới hạn của phép đo

- Cửa [1] (viết lại truy vấn) chưa được đo: bộ câu hỏi là đơn lượt nên bước rewrite không chạy. Cần golden set hội thoại nhiều lượt (FR-7) để đo cửa này.
- PASS nghĩa là gate xác nhận đủ căn cứ (\`enough_to_answer = true\`); bước sinh câu trả lời và trích dẫn chưa chạy trong harness này.
- Do chunk chồng lấn 15%, dữ kiện có thể xuất hiện ở chunk hàng xóm ngoài nhãn \`requiredChunkIds\` — vài ca "retrieval" có thể thực tế vẫn trả lời được nhờ chunk khác; soi \`diagnosis-raw.json\` khi nghi ngờ.
`;

    mkdirSync(evalDir, { recursive: true });
    const reportFile = join(evalDir, 'diagnosis-report.md');
    const rawFile = join(evalDir, 'diagnosis-raw.json');
    writeFileSync(reportFile, report, 'utf8');
    writeFileSync(
      rawFile,
      `${JSON.stringify({ config, usage, traces }, null, 2)}\n`,
      'utf8',
    );

    console.log('\nKET QUA:');
    console.log(`  PASS: ${passCount}/${answerable.length}`);
    for (const [key, count] of countBy(
      failures,
      (trace) => trace.classification,
    )) {
      console.log(`  ${key}: ${count}`);
    }
    console.log(
      `  bay lot: ${traps.filter((t) => t.classification === 'trap-leaked').length}/${traps.length}`,
    );
    console.log(`\nBao cao: ${reportFile}`);
    console.log(`Vet tho: ${rawFile}`);
  } finally {
    await ctx.close();
  }
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
