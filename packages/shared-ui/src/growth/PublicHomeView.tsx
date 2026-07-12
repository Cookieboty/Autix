import { useTranslations } from 'next-intl';
import {
  FeaturedModelsShowcase,
  HomeFeatureTags,
  HomeGallerySection,
  HomeHeroCuratedBar,
  HomeStarterSection,
} from './PublicHomeSections';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicHomeData } from './types';

/**
 * 首页视图：与 public-growth 域解耦，只吃 featured-slots（hero 运营位）+ Gallery（子组件自取 `/gallery/feed`）+
 * starter 区块（campaign hooks，见 HomeStarterSection）。静态标题/文案统一走 next-intl。
 */
export function PublicHomeView({ home }: { home?: PublicHomeData | null }) {
  const t = useTranslations('publicGrowth');
  const heroSlots = home?.heroSlots;

  return (
    <PublicGrowthShell showNav={false} showPromo={false}>
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
