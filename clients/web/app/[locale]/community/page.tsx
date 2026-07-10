import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { CommunityMarketplacePage } from './CommunityMarketplacePage';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata.community' });
  return {
    title: t('title'),
    description: t('description'),
    ...buildAlternates('/community', undefined, locale as SupportedLanguage),
  };
}

export default function CommunityPage() {
  return <CommunityMarketplacePage />;
}
