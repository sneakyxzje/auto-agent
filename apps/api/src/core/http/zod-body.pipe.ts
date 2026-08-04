import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Kiểm tra dữ liệu client gửi lên bằng schema zod, ngay tại cửa vào.
 *
 * TypeScript chỉ kiểm tra lúc biên dịch — chạy thật thì client gửi gì cũng lọt.
 * Pipe này chặn ở biên: sai kiểu là 400 kèm tên trường sai, service bên trong nhận
 * được dữ liệu đã sạch và đúng kiểu.
 */
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform = (value: unknown): T => {
    const parsed = this.schema.safeParse(value);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dữ liệu không hợp lệ',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return parsed.data;
  };
}
