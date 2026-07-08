import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGeneratorStudioView } from '@autix/shared-ui/growth';
import { getPublicCreations } from '@/lib/public-growth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.video');
  return {
    title: t('title'),
    description: t('description'),
  };
}

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function PublicVideoPage({ searchParams }: Props) {
  const params = await searchParams;
  const model = Array.isArray(params?.model) ? params?.model[0] : params?.model;
  const creations = await getPublicCreations({ mediaType: 'video', pageSize: 12 });
  return <PublicGeneratorStudioView kind="video" examples={creations?.items} initialModel={model} />;
}
