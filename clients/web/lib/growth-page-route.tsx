import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GrowthPageView } from '@autix/shared-ui/growth';
import { getPublicGrowthPage } from '@/lib/public-growth';

export async function buildGrowthPageMetadata(slug: string, locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata' });
  const page = await getPublicGrowthPage(slug, locale);
  return {
    title: page ? `${page.title} - Amux Studio` : t('growthPageTitleFallback'),
    description: page?.description ?? t('growthPageDescription'),
  };
}

export async function renderGrowthPage(slug: string, locale: string) {
  const page = await getPublicGrowthPage(slug, locale);
  return <GrowthPageView page={page} />;
}
