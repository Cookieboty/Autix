import { useTranslations } from 'next-intl';
import { getFallbackHome } from './fallback';
import {
  FeaturedModelsShowcase,
  HomeFeatureTags,
  HomeGallerySection,
  HomeStarterSection,
} from './PublicHomeSections';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthHome } from './types';

export function PublicHomeView({ home }: { home?: PublicGrowthHome | null }) {
  const t = useTranslations('publicGrowth');
  const data = home ?? getFallbackHome(t);

  return (
    <PublicGrowthShell promo={data.promo}>
      <main>
        <h1 className="sr-only">{t('home.title')}</h1>
        <FeaturedModelsShowcase />
        <HomeStarterSection />

        <HomeGallerySection
          title="Image Gallery"
          subtitle="Explore community templates and start creating in one click."
          viewAllHref="/ai/image?mode=templates"
          source="image"
        />

        <HomeGallerySection
          title="Video Gallery"
          subtitle="Bring your ideas to life with ready-to-use video templates."
          viewAllHref="/ai/video?mode=templates"
          source="video"
        />

        <HomeFeatureTags title="Explore more AI features" />
      </main>
    </PublicGrowthShell>
  );
}
