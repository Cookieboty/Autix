import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PresetDetailView } from '@autix/shared-ui/community';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('publicGrowth.metadata');
  const name = slug.replaceAll('-', ' ');
  return {
    title: t('presetTitle', { name }),
    description: t('presetDescription'),
  };
}

export default async function PresetDetailPage() {
  return <PresetDetailView />;
}
