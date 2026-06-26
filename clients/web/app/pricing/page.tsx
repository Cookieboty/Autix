import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicPricingView } from '@autix/shared-ui/growth';
import { getPublicMembershipLevels } from '@/lib/public-growth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.pricing');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function PricingPage() {
  const levels = await getPublicMembershipLevels();
  return <PublicPricingView levels={levels} />;
}
