import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { PlatformBinder } from '@/components/PlatformBinder';
import '@/lib/platform';
import "./globals.css";
import { Noto_Sans_SC } from "next/font/google";
import { cn } from "@/lib/utils";

const notoSans = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "Amux Admin - 用户管理系统",
  description: "Amux Admin 用户权限管理系统",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={cn("font-sans", notoSans.variable)}>
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
