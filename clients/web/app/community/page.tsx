import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CommunityMarketplacePage } from './CommunityMarketplacePage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.community');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default function CommunityPage() {
  return <CommunityMarketplacePage />;
}
