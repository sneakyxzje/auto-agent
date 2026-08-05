'use client';

import { type FormEvent, useState } from 'react';
import type { DepartmentSummary } from '@/features/departments/api';
import {
  ChevronDownIcon,
  DepartmentIcon,
  GridIcon,
  ImageIcon,
  MicIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
} from '@/features/workspace/icons';

const ALL_DEPARTMENTS = 'Tất cả phòng ban';

const CHIP_CLASS =
  'bg-surface border-border text-muted hover:text-foreground flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm';
const ROUND_BUTTON_CLASS =
  'border-border text-muted hover:text-foreground flex size-10 cursor-pointer items-center justify-center rounded-xl border bg-transparent';

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  departments: DepartmentSummary[];
  scope: string | null;
  onScopeChange: (slug: string | null) => void;
  busy: boolean;
  /** Đã vào hội thoại thì bỏ hàng chip trang trí, nhường chỗ cho nội dung. */
  compact?: boolean;
};

export const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  departments,
  scope,
  onScopeChange,
  busy,
  compact = false,
}: ChatComposerProps) => {
  const [scopeOpen, setScopeOpen] = useState(false);

  const scopeName =
    departments.find((department) => department.slug === scope)?.name ??
    ALL_DEPARTMENTS;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="border-border bg-surface overflow-hidden rounded-3xl border shadow-xs">
        {!compact && (
          <div className="border-border bg-background/60 flex items-center gap-2 border-b px-4 py-3">
            <button type="button" className={CHIP_CLASS} title="Sắp có">
              <SearchIcon className="size-4" />
              Tra tài liệu
            </button>
            <button type="button" className={CHIP_CLASS} title="Sắp có">
              <ImageIcon className="size-4" />
              Gửi kèm ảnh
            </button>
            <button type="button" className={CHIP_CLASS} title="Sắp có">
              <GridIcon className="size-4" />
              Thêm
            </button>
          </div>
        )}

        <div className="flex gap-3 px-4 pt-4">
          {!compact && (
            <span className="mt-1 size-7 shrink-0 rounded-full bg-linear-to-br from-sky-400 via-violet-400 to-amber-300" />
          )}

          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={compact ? 2 : 3}
            placeholder="Hỏi trợ lý về tài liệu nội bộ..."
            className={`text-foreground placeholder:text-muted w-full resize-none bg-transparent text-lg outline-none ${
              compact ? 'min-h-16' : 'min-h-24'
            }`}
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-4">
          <div className="flex items-center gap-2">
            {!compact && (
              <button
                type="button"
                aria-label="Thêm nội dung"
                title="Sắp có"
                className={ROUND_BUTTON_CLASS}
              >
                <PlusIcon className="size-5" />
              </button>
            )}

            <div className="relative">
              {scopeOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Đóng danh sách phòng ban"
                    onClick={() => setScopeOpen(false)}
                    className="fixed inset-0 z-10 cursor-default bg-transparent"
                  />
                  <div className="bg-surface border-border absolute bottom-full left-0 z-20 mb-2 max-h-72 w-64 overflow-y-auto rounded-xl border p-1 shadow-sm">
                    {[
                      { slug: null, name: ALL_DEPARTMENTS },
                      ...departments,
                    ].map((option) => (
                      <button
                        key={option.slug ?? 'all'}
                        type="button"
                        onClick={() => {
                          onScopeChange(option.slug);
                          setScopeOpen(false);
                        }}
                        className="hover:bg-surface-secondary w-full cursor-pointer rounded-lg bg-transparent px-3 py-2.5 text-left text-sm"
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setScopeOpen((open) => !open)}
                className="border-border hover:bg-surface-secondary flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-transparent px-3.5 text-sm font-medium"
              >
                <DepartmentIcon className="size-4 text-amber-500" />
                {scopeName}
                <ChevronDownIcon className="text-muted size-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!compact && (
              <button
                type="button"
                aria-label="Nhập bằng giọng nói"
                title="Sắp có"
                className={ROUND_BUTTON_CLASS}
              >
                <MicIcon className="size-5" />
              </button>
            )}

            <button
              type="submit"
              aria-label="Gửi câu hỏi"
              disabled={busy || value.trim().length === 0}
              className="bg-foreground text-background flex size-10 cursor-pointer items-center justify-center rounded-xl disabled:opacity-40"
            >
              <SendIcon className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
