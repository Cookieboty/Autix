import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { buildAlternates } from '@/lib/i18n/build-alternates';
import MarketplaceListPageContent from './MarketplaceListPageContent';

interface Props {
  params: Promise<{ locale: string; type: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type } = await params;
  return buildAlternates('/marketplace/[type]', { type }, locale as SupportedLanguage);
}

export default function MarketplaceListPage() {
  return <MarketplaceListPageContent />;
}
