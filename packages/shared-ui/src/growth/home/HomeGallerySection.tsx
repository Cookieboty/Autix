'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { publicGeneratorActions, type ImageTemplate } from '@autix/shared-store';
import { ImageTemplateGrid } from '../generator/image/ImageTemplateWall';
import { PublicImageTemplateDialog } from '../generator/image/ImageTemplateDialog';

export type HomeGallerySource = 'image' | 'video';

/**
 * 通用 Gallery 模块：Image Gallery / Video Gallery 共用。
 * 复用 /ai/image 的模板数据、卡片渲染与详情弹窗；只展示几排，底部渐隐 + View all。
 * 视频先复用图片数据，待视频模板接口就绪后按 source 切换。
 */
export function HomeGallerySection({
  title,
  subtitle,
  viewAllHref,
  source = 'image',
}: {
  title: string;
  subtitle?: string;
  viewAllHref: string;
  source?: HomeGallerySource;
}) {
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ImageTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    // TODO(video): 视频模板接口就绪后按 source 切换；目前视频先复用图片数据
    publicGeneratorActions
      .listImageTemplates({ sort: 'popular', pageSize: 24 })
      .then((items) => {
        if (!cancelled) setTemplates(items);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const goToViewAll = () => {
    window.location.href = viewAllHref;
  };

  if (!loading && templates.length === 0) return null;

  return (
    <section className="bg-background py-8 md:py-10">
      <div className="mx-auto max-w-[1920px] px-4 md:px-6">
        <div className="mb-6">
          <h2 className="text-3xl font-black uppercase tracking-tight text-growth-accent md:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p>
          ) : null}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-md bg-secondary" />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* 外层容器固定高度裁剪，约露出 3 排 */}
            <div className="h-[1000px] overflow-hidden md:h-[1140px]">
              <ImageTemplateGrid
                templates={templates}
                density="relaxed"
                onSelectTemplate={setSelected}
                onUseTemplate={goToViewAll}
                limit={24}
                compact
              />
            </div>

            {/* 底部渐隐 + View all 按钮（半透明） */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-64 items-end justify-center bg-gradient-to-t from-background via-background/85 to-transparent pb-4">
              <a
                href={viewAllHref}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-growth-accent/35 bg-growth-accent/20 px-5 py-2.5 text-sm font-bold text-growth-accent backdrop-blur-md transition hover:bg-growth-accent/30"
              >
                View all of {title}
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
        )}
      </div>

      <PublicImageTemplateDialog
        template={selected}
        onClose={() => setSelected(null)}
        onUsePrompt={goToViewAll}
      />
    </section>
  );
}
