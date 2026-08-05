import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auto Agent',
  description: 'Data Management',
};

const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-vi',
  display: 'swap',
});

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="vi" className={sans.variable}>
    <body>{children}</body>
  </html>
);

export default RootLayout;
