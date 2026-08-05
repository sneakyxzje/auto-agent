import type { ReactNode } from 'react';

type PageViewProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
};

export const PageView = ({
  title,
  subtitle,
  action,
  children,
}: PageViewProps) => (
  <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted mt-1 text-sm">{subtitle}</p>
        </div>

        {action}
      </div>

      {children}
    </div>
  </div>
);
