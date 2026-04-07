import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autix AI - 智能需求分析助理',
  description: 'Autix AI 智能对话系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased h-full min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
