'use client';

import { useTranslations } from 'next-intl';
import { Link } from '../../navigation';
import { IMAGE_NAV_FEATURES, imageModelHref, useImageNavModels } from '../image-nav';
import { VIDEO_NAV_FEATURES, videoModelHref, useVideoNavModels } from '../video-nav';

/**
 * 「EXPLORE MORE AI FEATURES」标签云。
 *
 * 收敛为两个导航下拉的全部项：Image 的 Features（Create / Edit / Gallery）+ 全部图片模型，
 * 加上 Video 的 Features（Create Video / Gallery）+ 全部视频模型，均可点击跳转。
 * 模型列表与跳转地址都与导航下拉、页尾同源 —— 这里不再自己维护一份名单，
 * 接入新模型后三处会一起更新。
 */
export function HomeFeatureTags({ title }: { title: string }) {
  const tImage = useTranslations('publicGrowth.imageNavFlyout');
  const tVideo = useTranslations('publicGrowth.videoNavFlyout');
  const imageModels = useImageNavModels();
  const videoModels = useVideoNavModels();

  /**
   * key 加 image-/video- 前缀：两边的 feature key 有重名（都有 'gallery'），
   * 直接用会撞 React key；模型 id 虽然不会重，但一并前缀保持一致。
   */
  const tags: Array<{ key: string; label: string; href: string }> = [
    ...IMAGE_NAV_FEATURES.map((feature) => ({
      key: `image-${feature.key}`,
      label: tImage(feature.key),
      href: feature.href,
    })),
    ...imageModels.map((model) => ({
      key: `image-${model.id}`,
      label: model.name,
      href: imageModelHref(model.name),
    })),
    ...VIDEO_NAV_FEATURES.map((feature) => ({
      key: `video-${feature.key}`,
      label: tVideo(feature.key),
      href: feature.href,
    })),
    ...videoModels.map((model) => ({
      key: `video-${model.id}`,
      label: model.name,
      href: videoModelHref(model.name),
    })),
  ];

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-4 text-center md:px-6">
        <h2 className="mb-8 text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
          {title}
        </h2>
        <div className="flex flex-wrap justify-center gap-2.5">
          {tags.map((tag) => (
            <Link
              key={tag.key}
              href={tag.href}
              className="rounded-lg border border-border bg-secondary px-3.5 py-1.5 text-sm font-medium text-foreground/65 transition hover:border-input hover:bg-accent hover:text-foreground"
            >
              {tag.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
