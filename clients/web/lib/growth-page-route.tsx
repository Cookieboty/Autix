import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GrowthPageView } from '@autix/shared-ui/growth';
import { getPublicGrowthPage } from '@/lib/public-growth';

export async function buildGrowthPageMetadata(slug: string): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata');
  const page = await getPublicGrowthPage(slug);
  return {
    title: page ? `${page.title} - Amux Studio` : t('growthPageTitleFallback'),
    description: page?.description ?? t('growthPageDescription'),
  };
}

export async function renderGrowthPage(slug: string) {
  const page = await getPublicGrowthPage(slug);
  return <GrowthPageView page={page} />;
}
