export type CitationEvent =
  | { type: 'text'; text: string }
  | { type: 'invalid'; marker: string };

/** Marker dài hơn mức này chắc chắn không phải trích dẫn, coi như text thường. */
const MAX_MARKER_LENGTH = 48;

const MARKER_OPEN = '[^';

/**
 * Đọc marker trích dẫn NGAY TRONG LÚC stream, không phải sau khi stream xong.
 *
 * Nếu để validate ở cuối thì người dùng đã đọc hết câu trả lời rồi mới thấy nó bị
 * xoá — mất niềm tin nặng hơn nhiều so với việc không trả lời ngay từ đầu. Cắt ở
 * token thứ hai mươi thì họ chỉ mất một dòng.
 *
 * Vì marker có thể bị chẻ đôi giữa hai delta ("[^c_" ở delta này, "ab12]" ở delta
 * sau), phần đuôi nghi là marker dở dang luôn được giữ lại trong bộ đệm thay vì
 * đẩy ra ngoài.
 */
export class CitationValidator {
  private buffer = '';
  private readonly cited = new Set<string>();

  constructor(private readonly allowed: Set<string>) {}

  readonly citedHandles = (): string[] => [...this.cited];

  readonly push = (delta: string): CitationEvent[] => {
    this.buffer += delta;
    const events: CitationEvent[] = [];

    while (this.buffer.length > 0) {
      const open = this.buffer.indexOf(MARKER_OPEN);

      if (open === -1) {
        // Dấu `[` cuối cùng có thể là đầu của một marker chưa gửi hết.
        const hold = this.buffer.endsWith('[')
          ? this.buffer.length - 1
          : this.buffer.length;
        if (hold > 0)
          events.push({ type: 'text', text: this.buffer.slice(0, hold) });
        this.buffer = this.buffer.slice(hold);
        break;
      }

      if (open > 0) {
        events.push({ type: 'text', text: this.buffer.slice(0, open) });
        this.buffer = this.buffer.slice(open);
      }

      const close = this.buffer.indexOf(']');

      if (close === -1) {
        if (this.buffer.length > MAX_MARKER_LENGTH) {
          events.push({ type: 'text', text: this.buffer });
          this.buffer = '';
        }
        break;
      }

      const marker = this.buffer.slice(0, close + 1);
      const handle = marker.slice(MARKER_OPEN.length, -1).trim();
      this.buffer = this.buffer.slice(close + 1);

      if (!this.allowed.has(handle)) {
        events.push({ type: 'invalid', marker });
        return events;
      }

      this.cited.add(handle);
      events.push({ type: 'text', text: marker });
    }

    return events;
  };

  readonly flush = (): CitationEvent[] => {
    if (this.buffer.length === 0) return [];

    const text = this.buffer;
    this.buffer = '';

    return [{ type: 'text', text }];
  };
}
