import type { Metadata } from 'next';
import { MotionProvider } from '@/components/landing/MotionProvider';
import { Navbar } from '@/components/landing/Navbar';
import { VideoLanding } from '@/components/landing/VideoLanding';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: '视频创作 - Amux Studio',
  description: '用视频模板、参考素材和 AI 导演会话生成可交付短视频。',
};

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
