'use client';

import { useTranslations } from 'next-intl';
import { Link } from '../../navigation';
import { IMAGE_NAV_FEATURES, imageModelHref, useImageNavModels } from '../image-nav';

/**
 * 「EXPLORE MORE AI FEATURES」标签云。
 * 收敛为导航 Image 下拉的全部项：Features（Create Image / Edit Image / Gallery）+ 全部图片模型，
 * 均可点击跳转。Video 暂不加，待 video 功能完善后再补 video 的功能与模型标签。
 */
export function HomeFeatureTags({ title }: { title: string }) {
  const t = useTranslations('publicGrowth.imageNavFlyout');
  const models = useImageNavModels();

  const tags: Array<{ key: string; label: string; href: string }> = [
    ...IMAGE_NAV_FEATURES.map((feature) => ({
      key: feature.key,
      label: t(feature.key),
      href: feature.href,
    })),
    ...models.map((model) => ({
      key: model.id,
      label: model.name,
      href: imageModelHref(model.name),
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
