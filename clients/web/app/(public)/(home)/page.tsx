import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicHomeView } from '@autix/shared-ui/public-home';
import { getPublicHome } from '@/lib/public-growth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.home');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function HomePage() {
  const home = await getPublicHome();
  return <PublicHomeView home={home} />;
}
