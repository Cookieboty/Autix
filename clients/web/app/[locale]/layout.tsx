import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { CookieConsent } from '@/components/CookieConsent';
import { PlatformBinder } from '@/components/PlatformBinder';
import { WebLocaleRouting } from '@/components/WebLocaleRouting';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/i18n/site-url';
import '@/lib/platform';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata.root' });

  return {
    metadataBase: SITE_URL,
    title: t('title'),
    description: t('description'),
    icons: {
      icon: [
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className="font-sans">
      <body className="antialiased h-full min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <WebLocaleRouting>
            <Providers>
              {/*
                页面槽位的 Suspense 边界。存在原因：若干 **noindex** 客户端页
                （pending / login / register / reset-password / activate / oauth/* /
                email/confirm 等）直接调用 useSearchParams 而未自带 Suspense；静态生成时
                这会触发 CSR bailout。此边界统一收口这些 noindex 页。

                对不 suspend 的页面（含 SEO 页）此边界完全透明——照常静态渲染出内容，
                original-series 等仍为 SSG。

                ⚠️ 代价（安全网丢失）：在此边界之前，缺 Suspense 的 useSearchParams 会让
                build **大声失败**在正确的位置；加了此边界后，一个内容会 suspend 的页面会
                **静默地预渲染成空壳**（路由仍标记为 Static，HTML 却是空的），而不是报错。
                对 noindex 页无害，但对可索引页是隐形 SEO 回归。

                因此：`marketplace/[type]` 的策略是 **`neutral`（可索引）**，它【不能】依赖
                这个根边界——那样静态壳会是空的。它在自己的 page.tsx 里自带 Suspense，
                fallback 渲染有意义的标记。**任何未来新增、且本地化策略为 `full` 或 `neutral`
                （即可索引）的路由，只要用了客户端 useSearchParams，都必须自带 Suspense 边界**，
                不能落到此根边界上。
              */}
              <PlatformBinder>
                <Suspense fallback={null}>{children}</Suspense>
              </PlatformBinder>
              <CookieConsent />
            </Providers>
          </WebLocaleRouting>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
