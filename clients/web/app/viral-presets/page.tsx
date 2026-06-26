import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PresetsIndexView } from '@autix/shared-ui/community';
import { getPublicCreations } from '@/lib/public-growth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.viralPresets');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ViralPresetsPage() {
  const creations = await getPublicCreations({ pageSize: 24, tag: 'marketing' });
  return <PresetsIndexView viral items={creations?.items} />;
}
