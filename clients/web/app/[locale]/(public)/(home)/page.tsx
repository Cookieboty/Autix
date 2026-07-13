import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicHomeView, type PublicHomeData } from '@autix/shared-ui/public-home';
import { getHomeHeroSlots } from '@/lib/home';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata.home' });
  return {
    title: t('title'),
    description: t('description'),
    ...buildAlternates('/', undefined, locale as SupportedLanguage),
  };
}

export default async function HomePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const heroSlots = await getHomeHeroSlots(locale);
  const home: PublicHomeData = { heroSlots: heroSlots ?? [] };
  return <PublicHomeView home={home} />;
}
