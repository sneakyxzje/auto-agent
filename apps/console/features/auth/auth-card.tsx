import { Card } from '@heroui/react';
import type { ReactNode } from 'react';

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export const AuthCard = ({
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) => (
  <div className="flex min-h-dvh items-center justify-center p-6">
    <Card className="w-full max-w-sm">
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>{subtitle}</Card.Description>
      </Card.Header>

      <Card.Content>{children}</Card.Content>

      <Card.Footer className="justify-center">
        <p className="text-default-500 text-sm">{footer}</p>
      </Card.Footer>
    </Card>
  </div>
);

export const authFormClassName = 'flex flex-col gap-4';
