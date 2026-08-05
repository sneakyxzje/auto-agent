/** Marker đã đóng: `[^c_48b027cb]`. */
const COMPLETE_MARKER = /\[\^[^\]\s]*\]/g;

/**
 * Marker mới ra được một nửa ở cuối luồng. Phải cắt luôn, không thì lúc gõ chữ
 * người dùng thấy `[^c_48b0` hiện ra rồi biến mất — nhấp nháy rất khó chịu.
 */
const PARTIAL_MARKER = /\[\^?[^\]\s]*$/;

/**
 * Bỏ marker khỏi phần hiển thị. Marker vẫn được gửi và vẫn được validate ở server
 * — nó là cơ chế chống bịa nguồn — chỉ là người đọc không cần nhìn thấy mã đoạn
 * giữa câu. Nguồn được gom lại thành danh sách nhỏ bên dưới câu trả lời.
 */
export const stripCitations = (content: string): string =>
  content
    .replace(COMPLETE_MARKER, '')
    .replace(PARTIAL_MARKER, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?)])/g, '$1');

export const MessageContent = ({ content }: { content: string }) => (
  <p className="text-base leading-relaxed whitespace-pre-wrap">
    {stripCitations(content)}
  </p>
);
