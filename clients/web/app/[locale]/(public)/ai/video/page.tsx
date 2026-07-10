import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicGeneratorStudioView } from '@autix/shared-ui/growth';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata.video' });
  return {
    title: t('title'),
    description: t('description'),
    ...buildAlternates('/ai/video', undefined, locale as SupportedLanguage),
  };
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicVideoPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const model = Array.isArray(sp?.model) ? sp?.model[0] : sp?.model;
  return <PublicGeneratorStudioView kind="video" initialModel={model} />;
}
