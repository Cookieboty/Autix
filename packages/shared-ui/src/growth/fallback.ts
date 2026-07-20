import type { PublicGrowthMediaItem, PublicGrowthPage } from './types';

type GrowthTranslator = (key: string, values?: Record<string, string | number>) => string;

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=82`;

const video = (file: string) =>
  `https://cdn.amux.ai/playground/video/video/demo/${file}`;

function prettifySlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function getFallbackItems(t: GrowthTranslator): PublicGrowthMediaItem[] {
  const baseItems: PublicGrowthMediaItem[] = [
    {
      id: 'fallback-image-studio',
      title: t('fallback.items.cinematicRoom.title'),
      subtitle: t('fallback.items.cinematicRoom.subtitle'),
      mediaType: 'image',
      mediaUrl: image('photo-1497366754035-f200968a6e72'),
      href: '/ai/image',
      badge: t('media.image'),
      tags: [t('fallback.tags.product'), t('fallback.tags.studio'), t('fallback.tags.campaign')],
      author: null,
    },
    {
      id: 'fallback-video-story',
      title: t('fallback.items.editorialLoop.title'),
      subtitle: t('fallback.items.editorialLoop.subtitle'),
      mediaType: 'video',
      mediaUrl: video('03.mp4'),
      posterUrl: image('photo-1516035069371-29a1b244cc32'),
      href: '/ai/video',
      badge: t('media.video'),
      tags: [t('fallback.tags.video'), t('fallback.tags.motion'), t('fallback.tags.launch')],
      author: null,
    },
    {
      id: 'fallback-marketing',
      title: t('fallback.items.launchCampaign.title'),
      subtitle: t('fallback.items.launchCampaign.subtitle'),
      mediaType: 'image',
      mediaUrl: image('photo-1557804506-669a67965ba0'),
      href: '/ai/image',
      badge: t('fallback.badges.growth'),
      tags: [t('fallback.tags.ads'), t('fallback.tags.marketing'), t('fallback.tags.scale')],
      author: null,
    },
    {
      id: 'fallback-canvas',
      title: t('fallback.items.canvasRemix.title'),
      subtitle: t('fallback.items.canvasRemix.subtitle'),
      mediaType: 'image',
      mediaUrl: image('photo-1497366216548-37526070297c'),
      href: '/draw',
      badge: t('fallback.badges.canvas'),
      tags: [t('fallback.tags.canvas'), t('fallback.tags.remix'), t('fallback.tags.reference')],
      author: null,
    },
    {
      id: 'fallback-series',
      title: t('fallback.items.seriesFrame.title'),
      subtitle: t('fallback.items.seriesFrame.subtitle'),
      mediaType: 'video',
      mediaUrl: video('short-film-mini.mp4'),
      posterUrl: image('photo-1519608487953-e999c86e7455'),
      href: '/ai/video',
      badge: t('fallback.badges.series'),
      tags: [t('fallback.tags.series'), t('fallback.tags.story'), t('fallback.tags.cinema')],
      author: null,
    },
  ];

  const variants: Array<{
    sourceIndex: number;
    id: string;
    mediaUrl: string;
    href: string;
    badge: string;
    posterUrl?: string;
    mediaType?: PublicGrowthMediaItem['mediaType'];
  }> = [
      {
        sourceIndex: 0,
        id: 'fallback-product-poster',
        mediaUrl: image('photo-1526947425960-945c6e72858f'),
        href: '/ai/image',
        badge: t('fallback.badges.growth'),
      },
      {
        sourceIndex: 1,
        id: 'fallback-fashion-motion',
        mediaUrl: video('high-impact-mini.mp4'),
        posterUrl: image('photo-1515886657613-9f3515b0c78f'),
        mediaType: 'video',
        href: '/ai/video',
        badge: t('media.video'),
      },
      {
        sourceIndex: 2,
        id: 'fallback-launch-room',
        mediaUrl: image('photo-1522202176988-66273c2fd55f'),
        href: '/ai/image',
        badge: t('fallback.badges.growth'),
      },
      {
        sourceIndex: 3,
        id: 'fallback-edit-board',
        mediaUrl: image('photo-1518005020951-eccb494ad742'),
        href: '/draw',
        badge: t('fallback.badges.edit'),
      },
      {
        sourceIndex: 4,
        id: 'fallback-world-frame',
        mediaUrl: video('action-v2-mini.mp4'),
        posterUrl: image('photo-1500530855697-b586d89ba3ee'),
        mediaType: 'video',
        href: '/ai/video',
        badge: t('fallback.badges.series'),
      },
    ];

  return [
    ...baseItems,
    ...variants.map((variant) => {
      const source = baseItems[variant.sourceIndex] ?? baseItems[0]!;
      return {
        ...source,
        id: variant.id,
        mediaUrl: variant.mediaUrl,
        posterUrl: variant.posterUrl ?? source.posterUrl,
        mediaType: variant.mediaType ?? source.mediaType,
        href: variant.href,
        badge: variant.badge,
      };
    }),
  ];
}

// 注：仓库内目前没有任何调用方（`grep -rn getFallbackPage` 只命中本文件的定义），
// 之前的默认值 `slug = 'marketing-studio'` 是个死链陷阱——一旦有新调用方漏传
// slug，会静默拿到一个不存在的路由。既然没有已知调用方依赖它，改成必填参数，
// 交给未来的调用方显式决定落地页 slug，而不是继续猜一个默认值。
export function getFallbackPage(t: GrowthTranslator, slug: string): PublicGrowthPage {
  const items = getFallbackItems(t);
  return {
    slug,
    eyebrow: t('growthPage.fallbackEyebrow'),
    title: prettifySlug(slug),
    description: t('fallback.page.description'),
    heroMedia: items[2].mediaUrl,
    ctaHref: '/ai/image',
    ctaLabel: t('growthPage.fallbackCta'),
    tags: [
      t('fallback.tags.publicPage'),
      t('fallback.tags.creationFlow'),
    ],
    sections: [
      {
        title: t('fallback.page.sections.create.title'),
        body: t('fallback.page.sections.create.body'),
      },
      {
        title: t('fallback.page.sections.publish.title'),
        body: t('fallback.page.sections.publish.body'),
      },
      {
        title: t('fallback.page.sections.discovery.title'),
        body: t('fallback.page.sections.discovery.body'),
      },
    ],
  };
}
