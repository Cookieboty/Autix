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
    <div style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />
      <HeroSection />
      <MarketplaceSection />
      <FeaturesSection />
      <WorkflowSection />
      <ShowcaseSection />
      <PricingSection />
      <TestimonialsSection />
      <CTABanner />
      <Footer />
    </div>
  );
}
