import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CreatorProfileView } from '@autix/shared-ui/public-profile';
import { getPublicCreator } from '@/lib/public-growth';

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const t = await getTranslations('publicGrowth.metadata');
  const detail = await getPublicCreator(handle);
  return {
    title: detail
      ? `${detail.profile.displayName} (@${detail.profile.handle}) - Amux Studio`
      : `@${handle} - Amux Studio`,
    description: detail?.profile.bio ?? t('creatorDescription'),
  };
}

export default async function CreatorPage({ params }: Props) {
  const { handle } = await params;
  const detail = await getPublicCreator(handle);
  return <CreatorProfileView detail={detail} />;
}
