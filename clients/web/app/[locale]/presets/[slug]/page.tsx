import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { PresetDetailView } from '@autix/shared-ui/community';
import { buildAlternates } from '@/lib/i18n/build-alternates';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata' });
  const name = slug.replaceAll('-', ' ');
  return {
    title: t('presetTitle', { name }),
    description: t('presetDescription'),
    ...buildAlternates('/presets/[slug]', { slug }, locale as SupportedLanguage),
  };
}

export default async function PresetDetailPage() {
  return <PresetDetailView />;
}
