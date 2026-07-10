import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { CommunityCollectionView } from '@autix/shared-ui/community';
import { getPublicCollection } from '@/lib/public-growth';
import { buildAlternates } from '@/lib/i18n/build-alternates';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata' });
  const detail = await getPublicCollection(slug, locale);
  return {
    title: detail
      ? t('collectionTitle', { title: detail.collection.title })
      : t('collectionFallbackTitle'),
    description: detail?.collection.description ?? t('collectionDescription'),
    ...buildAlternates('/community/[slug]', { slug }, locale as SupportedLanguage),
  };
}

export default async function CommunityCollectionPage({ params }: Props) {
  const { locale, slug } = await params;
  const detail = await getPublicCollection(slug, locale);
  return <CommunityCollectionView detail={detail} />;
}
