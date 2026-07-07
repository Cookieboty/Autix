import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PresetsIndexView } from '@autix/shared-ui/community';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.viralPresets');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ViralPresetsPage() {
  return <PresetsIndexView viral />;
}
