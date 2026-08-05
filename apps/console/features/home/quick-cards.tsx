import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import {
  ApproveIcon,
  ArrowRightIcon,
  DepartmentIcon,
  DocumentIcon,
  type IconProps,
} from '@/features/workspace/icons';

type QuickCard = {
  title: string;
  action: string;
  href: string | null;
  icon: ComponentType<IconProps>;
  tone: string;
};

const CARDS: QuickCard[] = [
  {
    title: 'Tài liệu phòng ban',
    action: 'Mở tài liệu',
    href: '/documents',
    icon: DocumentIcon,
    tone: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Phòng ban và lệnh /mã',
    action: 'Quản lý phòng ban',
    href: '/departments',
    icon: DepartmentIcon,
    tone: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'Duyệt tri thức mới',
    action: 'Sắp có',
    href: null,
    icon: ApproveIcon,
    tone: 'bg-violet-100 text-violet-700',
  },
];

const CARD_CLASS =
  'border-border bg-surface flex flex-col rounded-xl border shadow-xs';

const CardBody = ({ card }: { card: QuickCard }) => {
  const Icon = card.icon;

  return (
    <>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <span
          className={`flex size-11 items-center justify-center rounded-xl ${card.tone}`}
        >
          <Icon className="size-5.5" />
        </span>
        <p className="text-base font-medium">{card.title}</p>
      </div>

      <div className="border-border text-muted flex items-center justify-between border-t px-5 py-3.5 text-sm">
        <span>{card.action}</span>
        <ArrowRightIcon className="size-4" />
      </div>
    </>
  );
};

export const QuickCards = () => (
  <div className="grid gap-5 sm:grid-cols-3">
    {CARDS.map(
      (card): ReactNode =>
        card.href === null ? (
          <div key={card.title} className={CARD_CLASS} title="Sắp có">
            <CardBody card={card} />
          </div>
        ) : (
          <Link
            key={card.title}
            href={card.href}
            className={`${CARD_CLASS} hover:border-accent transition-colors`}
          >
            <CardBody card={card} />
          </Link>
        ),
    )}
  </div>
);
