import { useTranslations } from 'next-intl';
import {
  FeaturedModelsShowcase,
  HomeFeatureTags,
  HomeGallerySection,
  HomeHeroCuratedBar,
  HomeStarterSection,
} from './PublicHomeSections';
import { PublicGrowthShell } from './PublicGrowthShell';
import { SetPublicTopPromo } from './PublicTopPromo';
import type { PublicHomeData } from './types';

/**
 * 首页视图：与 public-growth 域解耦，只吃 featured-slots（hero 运营位）+ 灵感广场（图片+视频
 * 模板按 hotScore 热度混排，视频权重 1.5x，见 HomeGallerySection）+ starter 区块（campaign
 * hooks，见 HomeStarterSection）。静态标题/文案统一走 next-intl。
 */
export function PublicHomeView({ home }: { home?: PublicHomeData | null }) {
  const t = useTranslations('publicGrowth');
  const heroSlots = home?.heroSlots;

  return (
    <PublicGrowthShell showNav={false} showPromo={false}>
      {/* 首页顶部横幅：静态 i18n 文案（由 (public) layout 在导航上方渲染） */}
      <SetPublicTopPromo label={t('fallback.home.promo')} href="/pricing" />
      <main>
        <h1 className="sr-only">{t('home.title')}</h1>
        {heroSlots && heroSlots.length > 0 ? (
          <HomeHeroCuratedBar slots={heroSlots} />
        ) : (
          <FeaturedModelsShowcase />
        )}
        <HomeStarterSection />

        {/* 灵感广场：图片模板 + 视频模板按热度混排（后端 resource_metrics.hotScore 排序，
            视频权重 1.5x）。View all 目前落到 /ai/image?mode=gallery（已有的作品广场入口，
            视频广场是 /ai/video 的 tab；站点尚无统一 /gallery 索引，若后续新增可在此改指）。 */}
        <HomeGallerySection
          title={t('home.inspirationGalleryTitle')}
          subtitle={t('home.inspirationGallerySubtitle')}
          viewAllHref="/ai/image?mode=gallery"
          source="all"
        />

        <HomeFeatureTags title={t('home.featureTagsTitle')} />
      </main>
    </PublicGrowthShell>
  );
}
