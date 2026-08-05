import { type SQL, sql } from 'drizzle-orm';

export type Audience = 'internal' | 'public';

export type SearchScope = {
  audiences: Audience[];
  /** `null` là tìm toàn kho; mảng rỗng là không phòng nào, cố ý không trả gì. */
  departmentIds: string[] | null;
};

/**
 * Khách ngoài chỉ đọc được tài liệu `public`. Quy tắc này nằm ở đây, một chỗ duy
 * nhất, và không bao giờ nằm trong prompt — model không phải là hàng rào phân quyền.
 */
export const scopeFor = (
  isExternal: boolean,
  departmentIds: string[] | null,
): SearchScope => ({
  audiences: isExternal ? ['public'] : ['public', 'internal'],
  departmentIds,
});

/**
 * Mệnh đề WHERE phân quyền dùng chung cho MỌI truy vấn chạm vào `chunks`.
 *
 * Brief cấm viết rải rác mỗi nơi một kiểu: chỉ cần một câu truy vấn quên `audience`
 * là tài liệu nội bộ lọt ra ngoài, và kiểu lỗi đó không ai phát hiện bằng mắt.
 * Thêm điều kiện mới thì thêm ở đây, tự khắc mọi đường tìm kiếm đều nhận.
 */
export const chunkScopeSql = (alias: string, scope: SearchScope): SQL => {
  const column = (name: string): SQL => sql.raw(`${alias}.${name}`);

  const parts: SQL[] = [
    sql`${column('doc_status')} = 'published'`,
    sql`(${column('effective_to')} IS NULL OR ${column('effective_to')} > now())`,
    sql`${column('audience')}::text IN (${sql.join(
      scope.audiences.map((audience) => sql`${audience}`),
      sql`, `,
    )})`,
  ];

  if (scope.departmentIds !== null) {
    parts.push(
      scope.departmentIds.length === 0
        ? sql`false`
        : sql`${column('department_id')} IN (${sql.join(
            scope.departmentIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
    );
  }

  return sql.join(parts, sql` AND `);
};
