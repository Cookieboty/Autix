import { notFound } from 'next/navigation';
import { DocArticle } from '@/components/docs/DocArticle';
import { isValidDocLocale } from '@/lib/docs';
import { loadDoc, getStaticDocParams } from '@/lib/docs.server';

export function generateStaticParams() {
  return getStaticDocParams();
}

export default async function DocPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params;
  if (!isValidDocLocale(locale)) notFound();

  const docSlug = slug.join('/');
  const content = loadDoc(locale, docSlug);
  if (!content) notFound();

  return <DocArticle content={content} />;
}
