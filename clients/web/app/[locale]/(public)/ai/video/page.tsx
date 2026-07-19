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
  // Tab 在服务端就解析好（与 /ai/image 同一个 ?mode= 参数）：客户端读 location.search
  // 的话 SSR 拿不到，首帧会渲染成 history 选中，直接打开 ?mode=gallery 时 tab 不高亮。
  const modeParam = Array.isArray(sp?.mode) ? sp?.mode[0] : sp?.mode;
  const initialMode = modeParam === 'gallery' ? 'gallery' : undefined;
  return <PublicGeneratorStudioView kind="video" initialModel={model} initialMode={initialMode} />;
}
