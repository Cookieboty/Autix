import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { VideoSharePageView } from '@autix/shared-ui/video';
import { getSharedVideoProject } from '@/lib/video-share';
import { buildAlternates } from '@/lib/i18n/build-alternates';

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations('publicGrowth.metadata');
  const detail = await getSharedVideoProject(token);
  const image = detail?.thumbnailUrl || detail?.coverImage || undefined;
  const description = detail
    ? t('videoShareDescriptionWithModel', { model: detail.model })
    : t('videoShareDescription');
  return {
    title: detail ? t('videoShareTitle', { title: detail.title }) : t('videoShareFallbackTitle'),
    description,
    openGraph: detail ? {
      title: detail.title,
      description,
      images: image ? [image] : undefined,
      videos: detail.videoUrl ? [detail.videoUrl] : undefined,
      type: 'video.other',
    } : undefined,
    ...buildAlternates('/share/video/[token]', { token }, locale as SupportedLanguage),
  };
}

export default async function VideoSharePage({ params }: Props) {
  const { token } = await params;
  return <VideoSharePageView code={token} />;
}
