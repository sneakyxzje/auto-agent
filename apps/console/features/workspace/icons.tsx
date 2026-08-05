import type { ReactNode } from 'react';

export type IconProps = { className?: string };

type GlyphProps = IconProps & { children: ReactNode };

const Glyph = ({ className = 'size-4', children }: GlyphProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const LogoIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21" />
  </Glyph>
);

export const PanelLeftIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9.5 4v16" />
  </Glyph>
);

export const SearchIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Glyph>
);

export const HomeIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.8 9.6V20h12.4V9.6" />
  </Glyph>
);

export const ChatIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M20.5 12.4c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.4L4 20.5l1.4-3.7c-1.2-1.2-1.9-2.7-1.9-4.4 0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
  </Glyph>
);

export const DepartmentIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M4 20V6.5L11 4v16" />
    <path d="M11 9.5h6a2 2 0 0 1 2 2V20" />
    <path d="M2.8 20h18.4" />
    <path d="M7 9h1.5M7 12.5h1.5M14.5 13h1.5M14.5 16.5h1.5" />
  </Glyph>
);

export const DocumentIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" />
    <path d="M13.5 3.5V9H19" />
    <path d="M8.5 13.5h7M8.5 16.5h4.5" />
  </Glyph>
);

export const TicketIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M3.5 8.5V6.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.2 2.2 0 0 0 0 4.4v4.6a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-4.6a2.2 2.2 0 0 0 0-4.4Z" />
    <path d="M13.5 5v14" />
  </Glyph>
);

export const ApproveIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M20.5 11.2V12a8.5 8.5 0 1 1-5-7.8" />
    <path d="m8.5 11.5 3 3 9-9" />
  </Glyph>
);

export const MembersIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c0-2.8 2.5-4.8 5.5-4.8s5.5 2 5.5 4.8" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 6.2" />
    <path d="M17.5 14.9c1.8.6 3 2.2 3 4.6" />
  </Glyph>
);

export const ChartIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V6M17 20v-9" />
  </Glyph>
);

export const HelpIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.7 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.8-.9 1.4v.4" />
    <path d="M12 16.8h.01" />
  </Glyph>
);

export const SettingsIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M19.4 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.2a1.8 1.8 0 1 1-3.6 0V20a1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6H4a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.6-1.1V4a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.2a1.8 1.8 0 1 1 0 3.6H20a1.5 1.5 0 0 0-1.4.9Z" />
  </Glyph>
);

export const BellIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </Glyph>
);

export const ShareIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 15.5V4" />
    <path d="m8 7.6 4-3.6 4 3.6" />
    <path d="M5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V14" />
  </Glyph>
);

export const MoreIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="5.2" r="1.1" />
    <circle cx="12" cy="12" r="1.1" />
    <circle cx="12" cy="18.8" r="1.1" />
  </Glyph>
);

export const PlusIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 5v14M5 12h14" />
  </Glyph>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </Glyph>
);

export const ChevronUpDownIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />
  </Glyph>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M4.5 12h15" />
    <path d="m14 6.5 5.5 5.5L14 17.5" />
  </Glyph>
);

export const MicIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect x="9.2" y="3" width="5.6" height="11" rx="2.8" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3" />
  </Glyph>
);

export const SendIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M20.5 3.5 3.5 10.2l7 2.3 2.3 7 7.7-16Z" />
    <path d="m10.5 12.5 4.4-4.4" />
  </Glyph>
);

export const ClockIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Glyph>
);

export const SparkIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M13 3 6 13.2h5L10.5 21l7.5-10.4h-5L13 3Z" />
  </Glyph>
);

export const GridIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
  </Glyph>
);

export const ThumbUpIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M7 10.5 11 3a2.4 2.4 0 0 1 2.4 2.4V9h4.4a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7" />
    <rect x="3.2" y="10.5" width="3.8" height="8.5" rx="1.2" />
  </Glyph>
);

export const ThumbDownIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M7 13.5 11 21a2.4 2.4 0 0 0 2.4-2.4V15h4.4a2 2 0 0 0 2-2.3l-1-6a2 2 0 0 0-2-1.7H7" />
    <rect x="3.2" y="5" width="3.8" height="8.5" rx="1.2" />
  </Glyph>
);

export const ImageIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" />
    <circle cx="8.8" cy="9.6" r="1.5" />
    <path d="m4.5 17 4.8-4.6a1.8 1.8 0 0 1 2.5 0l5 4.9" />
  </Glyph>
);
