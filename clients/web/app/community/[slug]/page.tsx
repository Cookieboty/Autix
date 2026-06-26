import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CommunityCollectionView } from '@autix/shared-ui/community';
import { getPublicCollection } from '@/lib/public-growth';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('publicGrowth.metadata');
  const detail = await getPublicCollection(slug);
  return {
    title: detail
      ? t('collectionTitle', { title: detail.collection.title })
      : t('collectionFallbackTitle'),
    description: detail?.collection.description ?? t('collectionDescription'),
  };
}

export default async function CommunityCollectionPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getPublicCollection(slug);
  return <CommunityCollectionView detail={detail} />;
}
