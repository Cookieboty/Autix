import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGeneratorStudioView } from '@autix/shared-ui/growth';
import { getPublicCreations } from '@/lib/public-growth';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicGrowth.metadata.image');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function PublicImagePage({ searchParams }: Props) {
  const params = await searchParams;
  const model = Array.isArray(params?.model) ? params?.model[0] : params?.model;
  const creations = await getPublicCreations({ mediaType: 'image', pageSize: 12 });
  return <PublicGeneratorStudioView kind="image" examples={creations?.items} initialModel={model} />;
}
