import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicHomeView } from '@autix/shared-ui/public-home';
import { getPublicHome } from '@/lib/public-growth';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('publicGrowth.metadata.home');
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
  const home = await getPublicHome();
  return <PublicHomeView home={home} />;
}
