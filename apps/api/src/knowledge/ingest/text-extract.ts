import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { htmlToText } from './html-to-text';

export type EmbeddedImage = {
  id: number;
  buffer: Buffer;
  contentType: string;
};

export type ExtractedDocument = {
  text: string;
  images: EmbeddedImage[];
};

export const OCR_PLACEHOLDER_PREFIX = 'ocr-placeholder-';

/**
 * Bóc text; ảnh nhúng trong DOCX được đánh dấu placeholder tại đúng vị trí để
 * bước OCR chèn chữ đọc được vào sau. PDF chỉ bóc lớp text — PDF scan vẫn ngoài
 * phạm vi: file scan sẽ ra chuỗi rỗng và bị báo lỗi rõ ràng ở tầng trên.
 */
export const extractDocument = async (
  buffer: Buffer,
  fileName: string,
): Promise<ExtractedDocument> => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });

    return { text, images: [] };
  }

  if (extension === 'docx') {
    const images: EmbeddedImage[] = [];

    /**
     * Đi qua HTML chứ không dùng `extractRawText`: bản text thuần dẹp bảng thành
     * mỗi ô một dòng, mất sạch quan hệ hàng–cột. Tài liệu quy trình nội bộ thì
     * phần lớn nội dung có giá trị nằm trong bảng.
     */
    const { value } = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const id = images.length;
          images.push({
            id,
            buffer: await image.readAsBuffer(),
            contentType: image.contentType,
          });

          return { src: `${OCR_PLACEHOLDER_PREFIX}${id}` };
        }),
      },
    );

    return { text: htmlToText(value), images };
  }

  return { text: buffer.toString('utf8'), images: [] };
};

/** Chuẩn hóa xuống dòng và bỏ khoảng trắng thừa, giữ nguyên ranh giới đoạn văn. */
export const cleanText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const NUMBERED_HEADING_MAX = 60;
const UPPER_HEADING_MIN = 8;
const UPPER_HEADING_MAX = 80;

const NUMBERED_RULES: { pattern: RegExp; level: number }[] = [
  { pattern: /^[IVX]{1,4}[.)]\s+\S/, level: 1 },
  { pattern: /^\d{1,2}\.\d{1,2}[.)]?\s+\S/, level: 3 },
  { pattern: /^\d{1,2}[.)]\s+\S/, level: 2 },
];

const detectHeadingLevel = (line: string): number | null => {
  if (line.length === 0 || line.includes('|')) return null;
  if (/^[#\-+*•]/.test(line) || /[:;,]$/.test(line)) return null;

  for (const rule of NUMBERED_RULES) {
    if (rule.pattern.test(line)) {
      const cap = rule.level === 1 ? UPPER_HEADING_MAX : NUMBERED_HEADING_MAX;
      return line.length <= cap ? rule.level : null;
    }
  }

  if (
    /\p{L}/u.test(line) &&
    line.length >= UPPER_HEADING_MIN &&
    line.length <= UPPER_HEADING_MAX &&
    line === line.toLocaleUpperCase('vi') &&
    line.split(/\s+/).length >= 2
  ) {
    return 2;
  }

  return null;
};

/**
 * Tài liệu thật hiếm khi dùng Heading style của Word — tiêu đề mục thường chỉ là
 * dòng bôi đậm kiểu "IV. QUY TRÌNH..." hoặc "2. Quy trình...". Không nhận ra chúng
 * thì chunker mất sạch ngữ cảnh mục và các đoạn na ná giữa hai mục không phân biệt
 * được. Nhận nhầm một dòng liệt kê thành tiêu đề chỉ thêm một dòng ngữ cảnh thừa —
 * rẻ hơn nhiều so với bỏ sót.
 */
export const markHeadingLines = (text: string): string =>
  text
    .split('\n')
    .map((line) => {
      const level = detectHeadingLevel(line.trim());

      return level === null ? line : `\n${'#'.repeat(level)} ${line.trim()}\n`;
    })
    .join('\n');
