import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { buildAlternates } from '@/lib/i18n/build-alternates';
import MarketplaceDetailPageContent from './MarketplaceDetailPageContent';

interface Props {
  params: Promise<{ locale: string; type: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type, id } = await params;
  return buildAlternates('/marketplace/[type]/[id]', { type, id }, locale as SupportedLanguage);
}

export default function MarketplaceDetailPage() {
  return <MarketplaceDetailPageContent />;
}
