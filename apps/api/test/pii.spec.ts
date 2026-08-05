import { describe, expect, it } from 'vitest';
import { redactPii } from '../src/escalation/pii';

describe('redactPii', () => {
  it('ẩn số điện thoại Việt Nam ở các cách viết khác nhau', () => {
    const cases = ['0912345678', '0912 345 678', '+84912345678'];

    for (const phone of cases) {
      const result = redactPii(`Gọi cho anh Nam số ${phone} nhé`);

      expect(result.text).not.toContain(phone);
      expect(result.redactedCount).toBeGreaterThan(0);
    }
  });

  it('ẩn email và số căn cước', () => {
    const result = redactPii('Gửi mail toi nam@byscom.vn, CCCD 001203004567');

    expect(result.text).not.toContain('nam@byscom.vn');
    expect(result.text).not.toContain('001203004567');
  });

  it('giữ nguyên con số nghiệp vụ trong quy định', () => {
    const source =
      'Đi muộn 30 phút bị trừ 50.000đ, quá 3 lần trong tháng thì lập biên bản.';
    const result = redactPii(source);

    expect(result.text).toBe(source);
    expect(result.redactedCount).toBe(0);
  });
});
