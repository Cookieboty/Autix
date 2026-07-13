import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicPricingView } from '@autix/shared-ui/growth';
import { getPublicMembershipLevels, getPublicPointsPackages } from '@/lib/billing';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata.pricing' });
  return {
    title: t('title'),
    description: t('description'),
    ...buildAlternates('/pricing', undefined, locale as SupportedLanguage),
  };
}

export default async function PricingPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [levels, pointsPackages] = await Promise.all([
    getPublicMembershipLevels(locale),
    getPublicPointsPackages(locale),
  ]);
  return <PublicPricingView levels={levels} pointsPackages={pointsPackages} />;
}
