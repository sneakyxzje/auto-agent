'use client';

import { IMAGE_EXTENSIONS } from '@chatbot/contracts';
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DepartmentSummary } from '@/features/departments/api';
import {
  ImageIcon,
  MicIcon,
  PlusIcon,
  SendIcon,
  XIcon,
} from '@/features/workspace/icons';
import type { PendingImage } from './use-image-attachments';

const ACCEPT_IMAGES = IMAGE_EXTENSIONS.map((extension) => `.${extension}`).join(
  ',',
);

const ROUND_BUTTON_CLASS =
  'border-border text-muted hover:text-foreground flex size-10 cursor-pointer items-center justify-center rounded-xl border bg-transparent';

/** Lệnh chỉ tính khi đứng đầu ô nhập và chưa có khoảng trắng, khớp cách máy chủ tách lệnh. */
const COMMAND_PATTERN = /^\/([a-z0-9-]*)$/;

const ALL_OPTION = { slug: 'all', name: 'Tất cả phòng ban' };

type CommandOption = { slug: string; name: string };

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  departments: DepartmentSummary[];
  busy: boolean;
  images: PendingImage[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (localId: string) => void;
  canSend: boolean;
  /** Đã vào hội thoại thì bỏ hàng chip trang trí, nhường chỗ cho nội dung. */
  compact?: boolean;
};

export const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  departments,
  busy,
  images,
  onAddImages,
  onRemoveImage,
  canSend,
  compact = false,
}: ChatComposerProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const query = COMMAND_PATTERN.exec(value)?.[1] ?? null;
  const options: CommandOption[] =
    query === null
      ? []
      : [ALL_OPTION, ...departments].filter(
          (option) =>
            option.slug.includes(query) ||
            option.name.toLowerCase().includes(query),
        );

  const open = !dismissed && options.length > 0;
  const active = Math.min(highlight, options.length - 1);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  const openPicker = (): void => fileInputRef.current?.click();

  const pick = (option: CommandOption): void => {
    onChange(`/${option.slug} `);
    setDismissed(false);
    setHighlight(0);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % options.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(
          (current) => (current - 1 + options.length) % options.length,
        );
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissed(true);
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        const option = options[active];
        if (option !== undefined) {
          event.preventDefault();
          pick(option);
          return;
        }
      }
    }

    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    if (!busy && canSend) onSubmit();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setDismissed(false);
    setHighlight(0);
    onChange(event.target.value);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    onAddImages(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      {open && (
        <div className="border-border bg-surface absolute bottom-full left-0 z-20 mb-2 max-h-64 w-full max-w-sm overflow-y-auto rounded-xl border p-1 shadow-lg">
          <p className="text-muted px-3 pt-1 pb-2 text-[11px]">
            Chọn phòng ban rồi gõ câu hỏi — Enter để chọn, Esc để bỏ qua
          </p>

          {options.map((option, index) => (
            <button
              key={option.slug}
              ref={index === active ? activeRef : null}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              onMouseEnter={() => setHighlight(index)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                index === active ? 'bg-surface-secondary' : 'bg-transparent'
              }`}
            >
              <span className="text-muted shrink-0">/{option.slug}</span>
              <span className="truncate">{option.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="border-border bg-surface overflow-hidden rounded-3xl border shadow-xs">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-4">
            {images.map((image) => (
              <div key={image.localId} className="relative">
                <img
                  src={image.previewUrl}
                  alt="Ảnh đính kèm"
                  className={`size-16 rounded-lg border object-cover ${
                    image.error === null ? 'border-border' : 'border-red-400'
                  } ${image.imageId === null && image.error === null ? 'opacity-50' : ''}`}
                  title={image.error ?? undefined}
                />
                {image.imageId === null && image.error === null && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs">
                    ...
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(image.localId)}
                  aria-label="Gỡ ảnh"
                  className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-4 cursor-pointer items-center justify-center rounded-full"
                >
                  <XIcon className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 px-4 pt-4">
          {!compact && (
            <span className="mt-1 size-7 shrink-0 rounded-full bg-linear-to-br from-sky-400 via-violet-400 to-amber-300" />
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={compact ? 2 : 3}
            placeholder="Hỏi trợ lý — gõ / để chọn phòng ban"
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

            <button
              type="button"
              aria-label="Đính kèm ảnh"
              onClick={openPicker}
              className={ROUND_BUTTON_CLASS}
            >
              <ImageIcon className="size-5" />
            </button>
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
              disabled={busy || !canSend}
              className="bg-foreground text-background flex size-10 cursor-pointer items-center justify-center rounded-xl disabled:opacity-40"
            >
              <SendIcon className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        hidden
        onChange={handleFiles}
      />
    </form>
  );
};
