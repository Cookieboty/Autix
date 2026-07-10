import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { DocArticle } from '@/components/docs/DocArticle';
import { isValidDocLocale } from '@/lib/docs';
import { loadDoc, getStaticDocParams } from '@/lib/docs.server';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export function generateStaticParams() {
  return getStaticDocParams();
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string; slug: string[] }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  return buildAlternates('/docs/[...slug]', { slug: slug.join('/') }, locale as SupportedLanguage);
}

export default async function DocPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params;
  if (!isValidDocLocale(locale)) notFound();

  const docSlug = slug.join('/');
  const content = loadDoc(locale, docSlug);
  if (!content) notFound();

  return <DocArticle content={content} />;
}
