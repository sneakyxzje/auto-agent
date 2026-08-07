'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  BellIcon,
  type IconProps,
  MoreIcon,
  PanelLeftIcon,
  PlusIcon,
  ShareIcon,
} from './icons';

type TopbarProps = {
  sidebarOpen: boolean;
  onExpand: () => void;
  onMobileNav: () => void;
};

const ICON_BUTTON_CLASS =
  'bg-surface border-border text-muted hover:text-foreground flex size-9 cursor-pointer items-center justify-center rounded-lg border';

const IconAction = ({
  label,
  icon: Icon,
}: {
  label: string;
  icon: ComponentType<IconProps>;
}) => (
  <button
    type="button"
    aria-label={label}
    title="Sắp có"
    className={ICON_BUTTON_CLASS}
  >
    <Icon className="size-4" />
  </button>
);

export const Topbar = ({ sidebarOpen, onExpand, onMobileNav }: TopbarProps) => {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMobileNav}
          aria-label="Mở menu"
          className={`${ICON_BUTTON_CLASS} md:hidden`}
        >
          <PanelLeftIcon className="size-4" />
        </button>

        {!sidebarOpen && (
          <span className="hidden md:block">
            <button
              type="button"
              onClick={onExpand}
              aria-label="Mở thanh bên"
              className={ICON_BUTTON_CLASS}
            >
              <PanelLeftIcon className="size-4" />
            </button>
          </span>
        )}

        <Link
          href="/workspace?new=1"
          className="bg-surface border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"
        >
          <PlusIcon className="text-muted size-4" />
          Cuộc hỏi mới
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <IconAction label="Thông báo" icon={BellIcon} />
        <IconAction label="Chia sẻ" icon={ShareIcon} />
        <IconAction label="Tuỳ chọn khác" icon={MoreIcon} />
      </div>
    </header>
  );
};
