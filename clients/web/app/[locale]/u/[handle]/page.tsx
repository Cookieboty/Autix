import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { CreatorProfileView } from '@autix/shared-ui/public-profile';
import { getPublicCreator } from '@/lib/public-growth';
import { buildAlternates } from '@/lib/i18n/build-alternates';

interface Props {
  params: Promise<{ locale: string; handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, handle } = await params;
  const t = await getTranslations('publicGrowth.metadata');
  const detail = await getPublicCreator(handle);
  return {
    title: detail
      ? `${detail.profile.displayName} (@${detail.profile.handle}) - Amux Studio`
      : `@${handle} - Amux Studio`,
    description: detail?.profile.bio ?? t('creatorDescription'),
    ...buildAlternates('/u/[handle]', { handle }, locale as SupportedLanguage),
  };
}

export default async function CreatorPage({ params }: Props) {
  const { handle } = await params;
  const detail = await getPublicCreator(handle);
  return <CreatorProfileView detail={detail} />;
}
