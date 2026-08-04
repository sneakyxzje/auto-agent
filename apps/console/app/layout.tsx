import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auto Agent',
  description: 'Data Management',
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="vi">
    <body>{children}</body>
  </html>
);

export default RootLayout;
