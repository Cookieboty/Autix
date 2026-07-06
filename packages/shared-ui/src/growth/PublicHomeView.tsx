import { useTranslations } from 'next-intl';
import { getFallbackHome } from './fallback';
import {
  FeaturedModelsShowcase,
  HomeFeatureTags,
  HomeGallerySection,
  HomeHeroCuratedBar,
  HomeStarterSection,
} from './PublicHomeSections';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthHome } from './types';

export function PublicHomeView({ home }: { home?: PublicGrowthHome | null }) {
  const t = useTranslations('publicGrowth');
  const data = home ?? getFallbackHome(t);
  const heroSlots = home?.heroSlots;

  return (
    <PublicGrowthShell promo={data.promo}>
      <main>
        <h1 className="sr-only">{t('home.title')}</h1>
        {heroSlots && heroSlots.length > 0 ? (
          <HomeHeroCuratedBar slots={heroSlots} />
        ) : (
          <FeaturedModelsShowcase />
        )}
        <HomeStarterSection />

        <HomeGallerySection
          title={t('home.imageGalleryTitle')}
          subtitle={t('home.imageGallerySubtitle')}
          viewAllHref="/ai/image?mode=templates"
          source="image"
        />

        <HomeGallerySection
          title={t('home.videoGalleryTitle')}
          subtitle={t('home.videoGallerySubtitle')}
          viewAllHref="/ai/video?mode=templates"
          source="video"
        />

        <HomeFeatureTags title={t('home.featureTagsTitle')} />
      </main>
    </PublicGrowthShell>
  );
}
