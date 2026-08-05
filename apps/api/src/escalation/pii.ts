const MASK = '[đã ẩn]';

/**
 * Lọc thông tin cá nhân trước khi câu trả lời của người phụ trách đi vào kho tri
 * thức. Regex chạy trước, bước viết lại bằng model dọn nốt phần còn sót — hai lớp
 * vì mỗi lớp bắt một kiểu khác nhau: regex bắt định dạng, model bắt ngữ cảnh
 * ("số của chị Lan là ...").
 *
 * Thà ẩn nhầm một con số vô hại còn hơn để lọt một số căn cước vào kho tài liệu
 * mà cả công ty đọc được.
 */
const RULES: RegExp[] = [
  // Email
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  // Điện thoại Việt Nam: 0xxx hoặc +84xxx, cho phép dấu cách/chấm/gạch xen giữa
  /(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/g,
  // Căn cước 12 số, chứng minh thư 9 số, số tài khoản 13–19 số
  /\b\d{12}\b/g,
  /\b\d{9}\b/g,
  /\b\d{13,19}\b/g,
];

export type RedactionResult = {
  text: string;
  redactedCount: number;
};

export const redactPii = (input: string): RedactionResult => {
  let text = input;
  let redactedCount = 0;

  for (const rule of RULES) {
    text = text.replace(rule, () => {
      redactedCount += 1;
      return MASK;
    });
  }

  return { text, redactedCount };
};
