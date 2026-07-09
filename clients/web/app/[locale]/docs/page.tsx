import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { DocArticle } from '@/components/docs/DocArticle';
import { isValidDocLocale } from '@/lib/docs';
import { loadDoc, getStaticDocIndexParams } from '@/lib/docs.server';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export function generateStaticParams() {
  return getStaticDocIndexParams();
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildAlternates('/docs', undefined, locale as SupportedLanguage);
}

export default async function DocsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidDocLocale(locale)) notFound();

  const content = loadDoc(locale);
  if (!content) notFound();

  return <DocArticle content={content} />;
}
