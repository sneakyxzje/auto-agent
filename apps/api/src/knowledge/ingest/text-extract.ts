import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { htmlToText } from './html-to-text';

/**
 * Chỉ bóc text, không OCR: brief chốt tài liệu luôn có sẵn text, PDF scan nằm
 * ngoài phạm vi. File scan lọt vào đây sẽ ra chuỗi rỗng và bị báo lỗi rõ ràng ở
 * tầng trên, thay vì âm thầm tạo tài liệu không có nội dung.
 */
export const extractDocumentText = async (
  buffer: Buffer,
  fileName: string,
): Promise<string> => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });

    return text;
  }

  if (extension === 'docx') {
    /**
     * Đi qua HTML chứ không dùng `extractRawText`: bản text thuần dẹp bảng thành
     * mỗi ô một dòng, mất sạch quan hệ hàng–cột. Tài liệu quy trình nội bộ thì
     * phần lớn nội dung có giá trị nằm trong bảng.
     */
    const { value } = await mammoth.convertToHtml({ buffer });

    return htmlToText(value);
  }

  return buffer.toString('utf8');
};

/** Chuẩn hóa xuống dòng và bỏ khoảng trắng thừa, giữ nguyên ranh giới đoạn văn. */
export const cleanText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
