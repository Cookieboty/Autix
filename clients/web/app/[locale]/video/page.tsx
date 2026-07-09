import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { getTranslations } from 'next-intl/server';
import { MotionProvider } from '@/components/landing/MotionProvider';
import { Navbar } from '@/components/landing/Navbar';
import { VideoLanding } from '@/components/landing/VideoLanding';
import { Footer } from '@/components/landing/Footer';
import { buildAlternates } from '@/lib/i18n/build-alternates';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('metadata.video');

  return {
    title: t('title'),
    description: t('description'),
    ...buildAlternates('/video', undefined, locale as SupportedLanguage),
  };
}

export default function VideoPage() {
  return (
    <MotionProvider>
      <div style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <Navbar />
        <main>
          <VideoLanding />
        </main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
