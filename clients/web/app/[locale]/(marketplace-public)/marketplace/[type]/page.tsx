import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { buildAlternates } from '@/lib/i18n/build-alternates';
import MarketplaceListPageContent from './MarketplaceListPageContent';

interface Props {
  params: Promise<{ locale: string; type: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type } = await params;
  return buildAlternates('/marketplace/[type]', { type }, locale as SupportedLanguage);
}

// 已知的两个 marketplace 类型 → list 命名空间里的文案 key，用于给静态骨架一个「有意义」的
// 标题/描述，而非空壳。
const TYPE_COPY: Record<string, { eyebrow: string; description: string }> = {
  'image-templates': { eyebrow: 'list.imageEyebrow', description: 'list.imageDescription' },
  'video-templates': { eyebrow: 'list.videoEyebrow', description: 'list.videoDescription' },
};

export default async function MarketplaceListPage({ params }: Props) {
  const { locale, type } = await params;
  const t = await getTranslations({ locale, namespace: 'marketplace' });
  const copy = TYPE_COPY[type];

  return (
    // 本路由的策略是 `neutral`（可索引），且 MarketplaceListPageContent 直接使用
    // next/navigation 的 useSearchParams。若不在此自带 Suspense 边界，一旦有人给
    // [type] 加上 generateStaticParams，useSearchParams 会退回到 [locale]/layout.tsx
    // 的根 `<Suspense fallback={null}>`，向 Googlebot 交付一个【空 HTML 壳】而构建仍通过。
    // 因此在此就地包一层 Suspense，且 fallback 必须渲染有意义的标记（可索引路由的静态壳
    // 不能为空）。
    <Suspense
      fallback={
        <section aria-busy="true" className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl font-semibold">
            {copy ? t(copy.eyebrow) : type}
          </h1>
          {copy && <p className="mt-2 text-sm opacity-70">{t(copy.description)}</p>}
          <p className="mt-4 text-sm opacity-60">{t('common.loading')}</p>
        </section>
      }
    >
      <MarketplaceListPageContent />
    </Suspense>
  );
}
