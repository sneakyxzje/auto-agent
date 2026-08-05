const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Bản không dấu, chữ thường của một đoạn text — dùng cho tìm kiếm trigram.
 *
 * PostgreSQL không có từ điển tiếng Việt nên `to_tsvector` vô dụng ở đây; thay vào
 * đó là trigram trên cột đã bỏ dấu. Cả lúc ingest lẫn lúc tìm kiếm đều gọi ĐÚNG hàm
 * này, nên hai bên không thể lệch chuẩn hóa — đó là lý do không dùng `unaccent()`
 * của Postgres cho cột `content_norm`.
 */
export const normalizeForSearch = (text: string): string =>
  text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
