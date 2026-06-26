import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CommunityIndexView } from '@autix/shared-ui/community';
import { getPublicCollections, getPublicCreations } from '@/lib/public-growth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.community');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function CommunityPage() {
  const [collections, creations] = await Promise.all([
    getPublicCollections('COMMUNITY'),
    getPublicCreations({ pageSize: 24 }),
  ]);
  return <CommunityIndexView collections={collections} items={creations?.items} />;
}
