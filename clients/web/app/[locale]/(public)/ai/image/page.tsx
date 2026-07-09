import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGeneratorStudioView } from '@autix/shared-ui/growth';

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
  const modeParam = Array.isArray(params?.mode) ? params?.mode[0] : params?.mode;
  const initialMode = modeParam === 'templates' ? 'templates' : undefined;
  return (
    <PublicGeneratorStudioView
      kind="image"
      initialModel={model}
      initialMode={initialMode}
    />
  );
}
