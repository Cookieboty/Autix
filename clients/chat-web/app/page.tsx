import { MotionProvider } from '@/components/landing/MotionProvider';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { MarketplaceSection } from '@/components/landing/MarketplaceSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { WorkflowSection } from '@/components/landing/WorkflowSection';
import { ShowcaseSection } from '@/components/landing/ShowcaseSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { CTABanner } from '@/components/landing/CTABanner';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    // reducedMotion="user": 系统开启「减少动态效果」时自动跳过位移/缩放,
    // 仅保留不影响可读性的透明度渐变(内容不会因禁用动画而卡在隐藏态)。
    <MotionProvider>
      <div style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <Navbar />
        <main>
          <HeroSection />
          <MarketplaceSection />
          <FeaturesSection />
          <WorkflowSection />
          <ShowcaseSection />
          <PricingSection />
          <TestimonialsSection />
          <CTABanner />
        </main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
