import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { PlatformBinder } from '@/components/PlatformBinder';
import { WebLocaleRouting } from '@/components/WebLocaleRouting';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/i18n/site-url';
import '@/lib/platform';
import '../globals.css';

// 注意：`<LocaleHint />` 由 Task 12 加入（它创建 components/LocaleHint.tsx）。
// 本任务【不要】import 该模块——它尚不存在，会直接编译失败。

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
              {/* <LocaleHint /> —— Task 12 加入 */}
              {/*
                页面槽位的 Suspense 边界。存在原因：若干 noindex 客户端页
                （pending / login / register / reset-password / activate / oauth/* /
                marketplace/[type] / email/confirm 等）直接调用 useSearchParams 而未自带
                Suspense；静态生成时这会触发 CSR bailout。此边界统一收口它们。

                对不 suspend 的页面（含 SEO 页）此边界完全透明——照常静态渲染出内容，
                original-series 等仍为 SSG。

                ⚠️ 代价（安全网丢失）：在此边界之前，缺 Suspense 的 useSearchParams 会让
                build **大声失败**在正确的位置；加了此边界后，一个内容会 suspend 的页面会
                **静默地预渲染成空壳**（路由仍标记为 Static，HTML 却是空的），而不是报错。
                对 noindex 页无害；但**任何新增、且本地化策略为 `full` 的页面，必须检查其
                是否存在客户端 useSearchParams bailout**——否则会造成隐形的 SEO 回归。
              */}
              <PlatformBinder>
                <Suspense fallback={null}>{children}</Suspense>
              </PlatformBinder>
            </Providers>
          </WebLocaleRouting>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
