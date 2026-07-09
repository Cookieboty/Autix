import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MotionProvider } from '@/components/landing/MotionProvider';
import { Navbar } from '@/components/landing/Navbar';
import { VideoLanding } from '@/components/landing/VideoLanding';
import { Footer } from '@/components/landing/Footer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.video');

  return {
    title: t('title'),
    description: t('description'),
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
