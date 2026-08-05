'use client';

import { useCallback, useEffect, useState } from 'react';
import { type DepartmentSummary, listDepartments } from './api';

export type { DepartmentSummary };

/**
 * Giữ lại danh sách giữa các lần chuyển trang: không có nó thì mỗi màn hình lại
 * bắt đầu từ mảng rỗng, chip đếm phòng ban nhảy 0 → N và ô lọc chớp một nhịp.
 * Vẫn gọi lại API mỗi lần mount, chỉ khác là hiển thị dữ liệu cũ trong lúc chờ.
 */
let cached: DepartmentSummary[] | null = null;

export const clearDepartmentsCache = (): void => {
  cached = null;
};

export const useDepartments = () => {
  const [departments, setDepartments] = useState<DepartmentSummary[]>(
    cached ?? [],
  );
  const [loading, setLoading] = useState(cached === null);

  const reload = useCallback(async () => {
    try {
      const list = await listDepartments();
      cached = list;
      setDepartments(list);
    } catch {
      setDepartments(cached ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { departments, loading, reload };
};
