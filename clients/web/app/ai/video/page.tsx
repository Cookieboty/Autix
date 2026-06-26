import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGeneratorStudioView } from '@autix/shared-ui/growth';
import { getPublicCreations } from '@/lib/public-growth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.video');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function PublicVideoPage() {
  const creations = await getPublicCreations({ mediaType: 'video', pageSize: 12 });
  return <PublicGeneratorStudioView kind="video" examples={creations?.items} />;
}
