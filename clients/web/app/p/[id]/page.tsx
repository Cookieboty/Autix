import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicCreationDetailView } from '@autix/shared-ui/public-creation';
import { getPublicCreation } from '@/lib/public-growth';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('publicGrowth.metadata');
  const item = await getPublicCreation(id);
  const description = item?.description || item?.subtitle || t('publicCreationDescription');
  return {
    title: item ? `${item.title} - Amux Studio` : t('publicCreationTitleFallback'),
    description,
    openGraph: item ? {
      title: item.title,
      description,
      images: item.posterUrl || item.mediaUrl ? [item.posterUrl || item.mediaUrl] : undefined,
      type: item.mediaType === 'video' ? 'video.other' : 'article',
    } : undefined,
  };
}

export default async function PublicCreationPage({ params }: Props) {
  const { id } = await params;
  const item = await getPublicCreation(id);
  return <PublicCreationDetailView item={item} />;
}
