const ENTITIES: [RegExp, string][] = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, '&'],
];

const decode = (text: string): string =>
  ENTITIES.reduce(
    (result, [pattern, value]) => result.replace(pattern, value),
    text,
  );

const stripTags = (html: string): string =>
  decode(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Mỗi hàng của bảng thành MỘT dòng, các ô ngăn bằng `|`.
 *
 * Đây là chỗ quan trọng nhất của file này. Bóc bảng theo kiểu text thuần thì mỗi ô
 * rơi xuống một dòng riêng và quan hệ hàng–cột biến mất: đọc "5" mà không biết nó
 * thuộc cột "Học việc" hay "Level 2". Model không đoán được, bước gate sẽ kết luận
 * không đủ căn cứ, và bot từ chối một câu hỏi mà tài liệu thật ra có trả lời.
 */
const tableToText = (inner: string): string =>
  [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(([, row]) =>
      [...(row ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(([, cell]) => stripTags(cell ?? ''))
        .join(' | '),
    )
    .filter((row) => row.replace(/\|/g, '').trim().length > 0)
    .join('\n');

/**
 * Chuyển HTML của mammoth thành text giữ được cấu trúc: bảng thành hàng, tiêu đề
 * mang tiền tố `#` để bộ chia đoạn nhận ra ranh giới mục.
 */
export const htmlToText = (html: string): string => {
  const withImagePlaceholders = html.replace(
    /<img[^>]*src="ocr-placeholder-(\d+)"[^>]*\/?>/gi,
    (_, id: string) => `\n[[OCR:${id}]]\n`,
  );

  const withTables = withImagePlaceholders.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (_, inner: string) => `\n\n${tableToText(inner)}\n\n`,
  );

  const withHeadings = withTables.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, inner: string) =>
      `\n\n${'#'.repeat(Number(level))} ${stripTags(inner)}\n\n`,
  );

  const withLists = withHeadings.replace(
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    (_, inner: string) => `\n- ${stripTags(inner)}`,
  );

  return decode(
    withLists
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  );
};
