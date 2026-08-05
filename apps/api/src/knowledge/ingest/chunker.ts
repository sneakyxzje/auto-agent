export type TextChunk = {
  content: string;
  tokenCount: number;
};

/**
 * Ước lượng token thay vì gọi tokenizer thật: tiếng Việt có dấu rơi vào khoảng 3
 * ký tự một token với bộ mã hoá của OpenAI. Con số này chỉ dùng để cắt đoạn cho
 * đều, lệch vài phần trăm không ảnh hưởng chất lượng tìm kiếm — đổi lại không phải
 * kéo thêm tokenizer nặng vào cả API lẫn worker.
 */
const CHARS_PER_TOKEN = 3;

const TARGET_TOKENS = 700;
const MAX_TOKENS = 800;
const OVERLAP_RATIO = 0.15;

const HEADING_PATTERN = /^#{1,6}\s+/;

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

const MAX_UNIT_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

type Unit = {
  text: string;
  /** Tiêu đề mục gần nhất đứng trước đơn vị này. */
  heading: string | null;
};

/** Cắt theo câu, không cắt giữa câu — trừ khi một "câu" dài quá mức cho phép. */
const splitSentences = (paragraph: string): string[] => {
  const sentences = paragraph.match(/[^.!?;\n]+[.!?;]*\s*/g) ?? [paragraph];
  const units: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.length <= MAX_UNIT_CHARS) {
      units.push(trimmed);
      continue;
    }

    for (let start = 0; start < trimmed.length; start += MAX_UNIT_CHARS) {
      units.push(trimmed.slice(start, start + MAX_UNIT_CHARS));
    }
  }

  return units;
};

/**
 * Khối quá dài thì hạ xuống mức DÒNG trước, mức câu sau.
 *
 * Thứ tự này quan trọng với bảng: mỗi hàng là một dòng, cắt theo dòng thì hàng còn
 * nguyên. Nhảy thẳng xuống mức câu sẽ cắt "16.000.000" thành "16." và "000." vì
 * dấu chấm phân cách nghìn bị coi là hết câu.
 */
const splitOversized = (block: string): string[] => {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length > 1) {
    return lines.flatMap((line) =>
      line.length <= MAX_UNIT_CHARS ? [line] : splitSentences(line),
    );
  }

  return splitSentences(block);
};

/**
 * Đơn vị nhỏ nhất là một đoạn văn (hoặc một bảng). Đoạn nào quá dài mới bị chia
 * nhỏ, nhờ vậy phần lớn chunk vẫn trùng ranh giới đoạn văn của tài liệu gốc.
 */
const splitUnits = (text: string): Unit[] => {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const units: Unit[] = [];
  let heading: string | null = null;

  for (const block of blocks) {
    if (HEADING_PATTERN.test(block)) {
      heading = block.replace(HEADING_PATTERN, '').trim();
      units.push({ text: heading, heading });
      continue;
    }

    if (estimateTokens(block) <= MAX_TOKENS) {
      units.push({ text: block, heading });
      continue;
    }

    for (const piece of splitOversized(block)) {
      units.push({ text: piece, heading });
    }
  }

  return units;
};

/** Vài câu cuối của một đoạn văn, dùng khi cả đoạn dài hơn ngân sách chồng lấn. */
const trailingSentences = (unit: string, budget: number): string[] => {
  const sentences = splitSentences(unit);
  const tail: string[] = [];
  let tokens = 0;

  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    const sentence = sentences[index];
    if (sentence === undefined) break;

    const sentenceTokens = estimateTokens(sentence);
    if (tokens + sentenceTokens > budget && tail.length > 0) break;

    tail.unshift(sentence);
    tokens += sentenceTokens;

    if (tokens >= budget) break;
  }

  return tail.length === 0 ? [] : [tail.join(' ')];
};

/**
 * Phần chồng lấn cho chunk kế tiếp: ưu tiên nguyên đoạn văn, nhưng tài liệu thật
 * hay có đoạn dài hơn cả ngân sách 15% — lúc đó phải hạ xuống mức câu, không thì
 * chồng lấn thành rỗng và câu trả lời nằm vắt qua ranh giới hai chunk sẽ bị mất.
 */
const overlapUnits = (units: Unit[]): Unit[] => {
  const budget = TARGET_TOKENS * OVERLAP_RATIO;
  const carried: Unit[] = [];
  let tokens = 0;

  for (let index = units.length - 1; index > 0; index -= 1) {
    const unit = units[index];
    if (unit === undefined) break;

    const unitTokens = estimateTokens(unit.text);
    if (tokens + unitTokens > budget) break;

    carried.unshift(unit);
    tokens += unitTokens;
  }

  if (carried.length > 0) return carried;

  const last = units.at(-1);
  if (last === undefined) return [];

  return trailingSentences(last.text, budget).map((text) => ({
    text,
    heading: last.heading,
  }));
};

/**
 * 600–800 token mỗi đoạn, chồng lấn ~15%, cắt theo ranh giới đoạn văn. Cố ý không
 * làm chia đoạn cha–con: ở quy mô 5k–50k đoạn nó thêm một tầng vào cả ingest lẫn
 * lúc dựng prompt mà đổi lại rất ít.
 *
 * Mỗi chunk mang theo tiêu đề mục của nó. Một bảng dài bị cắt làm đôi thì nửa sau
 * chỉ còn dãy số trần — không biết là bảng gì, tìm kiếm không khớp, và model đọc
 * cũng không hiểu. Dòng tiêu đề đứng đầu chunk chữa đúng chỗ đó.
 */
export const chunkText = (text: string): TextChunk[] => {
  const units = splitUnits(text);
  const chunks: TextChunk[] = [];

  let current: Unit[] = [];
  let tokens = 0;

  const compose = (parts: Unit[]): string => {
    const body = parts.map((part) => part.text).join('\n\n');
    const heading = parts[0]?.heading ?? null;

    return heading === null || body.startsWith(heading)
      ? body
      : `${heading}\n\n${body}`;
  };

  const flush = (): void => {
    if (current.length === 0) return;

    const content = compose(current);
    chunks.push({ content, tokenCount: estimateTokens(content) });

    const carried = overlapUnits(current);
    current = carried;
    tokens = carried.reduce((sum, unit) => sum + estimateTokens(unit.text), 0);
  };

  for (const unit of units) {
    const unitTokens = estimateTokens(unit.text);

    if (tokens + unitTokens > MAX_TOKENS && current.length > 0) flush();

    current.push(unit);
    tokens += unitTokens;

    if (tokens >= TARGET_TOKENS) flush();
  }

  // Phần đuôi còn lại: bỏ qua nếu nó chỉ là bản sao của phần chồng lấn vừa cắt.
  if (current.length > 0) {
    const content = compose(current);
    const last = chunks.at(-1);

    if (last === undefined || !last.content.endsWith(content)) {
      chunks.push({ content, tokenCount: estimateTokens(content) });
    }
  }

  return chunks;
};
