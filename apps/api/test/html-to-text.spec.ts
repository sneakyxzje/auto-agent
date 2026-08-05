import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/knowledge/ingest/chunker';
import { htmlToText } from '../src/knowledge/ingest/html-to-text';
import { cleanText } from '../src/knowledge/ingest/text-extract';

describe('htmlToText', () => {
  it('giữ quan hệ hàng–cột của bảng trên một dòng', () => {
    const html =
      '<table><tr><td><p>Nội dung</p></td><td><p>Học việc</p></td><td><p>Level 2</p></td></tr>' +
      '<tr><td><p>Số lượng data/tháng</p></td><td><p>190</p></td><td><p>110</p></td></tr></table>';

    const text = htmlToText(html);

    expect(text).toContain('Nội dung | Học việc | Level 2');
    expect(text).toContain('Số lượng data/tháng | 190 | 110');
  });

  it('đánh dấu tiêu đề để bộ chia đoạn nhận ra ranh giới mục', () => {
    const text = htmlToText(
      '<h2>MỤC TIÊU SỐ LƯỢNG CONTACT</h2><p>Nội dung</p>',
    );

    expect(text).toContain('## MỤC TIÊU SỐ LƯỢNG CONTACT');
  });

  it('bỏ thẻ và giải mã ký tự đặc biệt', () => {
    const text = htmlToText('<p>Ph&#39;i &amp; th&quot;&nbsp;nghi&lt;m</p>');

    expect(text).not.toContain('<p>');
    expect(text).toContain('Ph\'i & th" nghi<m');
  });
});

describe('chunkText với bảng', () => {
  const table = [
    '## MỤC TIÊU SỐ LƯỢNG CONTACT',
    '',
    ...Array.from(
      { length: 60 },
      (_, index) =>
        `Chỉ tiêu số ${index} | 16.000.000 | 25.000.000 | 35.000.000`,
    ),
  ].join('\n');

  it('không cắt giữa con số khi phải chia bảng dài', () => {
    const chunks = chunkText(cleanText(table));

    for (const chunk of chunks) {
      expect(chunk.content).not.toMatch(/16\.\n/);
      expect(chunk.content).not.toMatch(/\n000\./);
    }
  });

  it('mỗi đoạn của bảng dài đều mang theo tiêu đề mục', () => {
    const chunks = chunkText(cleanText(table));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content).toContain('MỤC TIÊU SỐ LƯỢNG CONTACT');
    }
  });
});
