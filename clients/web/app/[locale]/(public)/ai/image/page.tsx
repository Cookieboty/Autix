import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicGeneratorStudioView } from '@autix/shared-ui/growth';
import { buildAlternates } from '@/lib/i18n/build-alternates';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicGrowth.metadata.image' });
  return {
    title: t('title'),
    description: t('description'),
    ...buildAlternates('/ai/image', undefined, locale as SupportedLanguage),
  };
}

export default async function PublicImagePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const model = Array.isArray(sp?.model) ? sp?.model[0] : sp?.model;
  const modeParam = Array.isArray(sp?.mode) ? sp?.mode[0] : sp?.mode;
  // Plan C Task 12：广场详情页「recreate」跳转带 prompt query（?prompt=...），预填生成器输入框。
  const prompt = Array.isArray(sp?.prompt) ? sp?.prompt[0] : sp?.prompt;
  const initialMode = modeParam === 'gallery' ? 'gallery' : undefined;
  return (
    <PublicGeneratorStudioView
      kind="image"
      initialModel={model}
      initialMode={initialMode}
      initialPrompt={prompt}
    />
  );
}
