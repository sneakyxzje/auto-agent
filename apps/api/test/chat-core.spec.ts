import { describe, expect, it } from 'vitest';
import { CitationValidator } from '../src/chat/citation-parser';
import { parseMessage } from '../src/chat/conversation.service';
import { chunkText, estimateTokens } from '../src/knowledge/ingest/chunker';

const collect = (validator: CitationValidator, deltas: string[]) => {
  const text: string[] = [];
  let invalid: string | null = null;

  for (const delta of deltas) {
    for (const event of validator.push(delta)) {
      if (event.type === 'invalid') {
        invalid = event.marker;
        break;
      }

      text.push(event.text);
    }

    if (invalid !== null) break;
  }

  if (invalid === null) {
    for (const event of validator.flush()) {
      if (event.type === 'text') text.push(event.text);
    }
  }

  return { text: text.join(''), invalid };
};

describe('CitationValidator', () => {
  it('giữ marker hợp lệ và ghi nhận đoạn được trích dẫn', () => {
    const validator = new CitationValidator(new Set(['c_12ab']));
    const result = collect(validator, ['Phạt 50.000đ', ' [^c_12ab]', ' nhé.']);

    expect(result.invalid).toBeNull();
    expect(result.text).toBe('Phạt 50.000đ [^c_12ab] nhé.');
    expect(validator.citedHandles()).toEqual(['c_12ab']);
  });

  it('ghép được marker bị chẻ đôi giữa hai delta', () => {
    const validator = new CitationValidator(new Set(['c_12ab']));
    const result = collect(validator, [
      'Đi muộn 30 phút [^c_',
      '12ab] bị trừ.',
    ]);

    expect(result.invalid).toBeNull();
    expect(result.text).toBe('Đi muộn 30 phút [^c_12ab] bị trừ.');
  });

  it('ngắt ngay tại marker lạ, không cho phần sau lọt ra', () => {
    const validator = new CitationValidator(new Set(['c_12ab']));
    const result = collect(validator, [
      'Theo quy định [^c_9999] thì bị phạt 200.000đ.',
    ]);

    expect(result.invalid).toBe('[^c_9999]');
    expect(result.text).toBe('Theo quy định ');
    expect(result.text).not.toContain('200.000đ');
  });

  it('không giữ lại text sau dấu ngoặc thường', () => {
    const validator = new CitationValidator(new Set([]));
    const result = collect(validator, ['Mức phạt [xem bảng] là 50.000đ.']);

    expect(result.invalid).toBeNull();
    expect(result.text).toBe('Mức phạt [xem bảng] là 50.000đ.');
  });
});

describe('parseMessage', () => {
  it('tách lệnh phòng ban khỏi nội dung câu hỏi', () => {
    expect(parseMessage('/account đi muộn 30p phạt bao nhiêu')).toEqual({
      slug: 'account',
      clearHint: false,
      text: 'đi muộn 30p phạt bao nhiêu',
    });
  });

  it('/all là xoá bộ lọc chứ không phải tên phòng ban', () => {
    expect(parseMessage('/all quy trình nghỉ phép')).toEqual({
      slug: null,
      clearHint: true,
      text: 'quy trình nghỉ phép',
    });
  });

  it('câu hỏi không có lệnh thì giữ nguyên', () => {
    expect(parseMessage('vậy 1 tiếng thì sao')).toEqual({
      slug: null,
      clearHint: false,
      text: 'vậy 1 tiếng thì sao',
    });
  });
});

describe('chunkText', () => {
  const paragraph = (index: number): string =>
    `Đoạn số ${index}. ${'Nội dung quy định nội bộ của công ty. '.repeat(12)}`;

  it('cắt đoạn trong khoảng token cho phép', () => {
    const text = Array.from({ length: 20 }, (_, index) =>
      paragraph(index),
    ).join('\n\n');

    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(estimateTokens(chunk.content)).toBeLessThanOrEqual(900);
    }
  });

  it('chunk kế tiếp mang theo phần chồng lấn của chunk trước', () => {
    const text = Array.from({ length: 20 }, (_, index) =>
      paragraph(index),
    ).join('\n\n');

    const chunks = chunkText(text);
    const first = chunks[0];
    const second = chunks[1];

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const carried = second?.content.split('\n\n')[0] ?? '';
    expect(carried.length).toBeGreaterThan(0);
    expect(first?.content.includes(carried)).toBe(true);
  });

  it('tài liệu ngắn chỉ ra đúng một đoạn', () => {
    const chunks = chunkText('Nghỉ phép năm là 12 ngày.');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('Nghỉ phép năm là 12 ngày.');
  });
});
