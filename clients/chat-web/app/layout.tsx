import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { PlatformBinder } from '@/components/PlatformBinder';
import '@/lib/platform';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amux Studio — Think it. Build it. Ship it.',
  description: 'PRD · 代码 · 设计 · 原型，AI 一站生成',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased h-full min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <PlatformBinder>{children}</PlatformBinder>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
