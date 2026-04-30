import { notFound } from 'next/navigation';
import { DocArticle } from '@/components/docs/DocArticle';
import { isValidDocLocale } from '@/lib/docs';
import { loadDoc, getStaticDocIndexParams } from '@/lib/docs.server';

export function generateStaticParams() {
  return getStaticDocIndexParams();
}

export default async function DocsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidDocLocale(locale)) notFound();

  const content = loadDoc(locale);
  if (!content) notFound();

  return <DocArticle content={content} />;
}
