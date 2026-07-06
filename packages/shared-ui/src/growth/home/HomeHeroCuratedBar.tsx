'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { ResolvedFeaturedSlot } from '@autix/domain';

// 卡片视觉与横向 rail 与 FeaturedModelsShowcase 保持一致，仅数据来源换成 DB 解析后的运营位。
function SlotCard({ slot }: { slot: ResolvedFeaturedSlot }) {
  const title = slot.title ?? '';
  const description = slot.description ?? '';
  const href = slot.ctaHref ?? '#';

  return (
    <a
      href={href}
      className="group/card w-[80%] shrink-0 snap-start sm:w-[42%] lg:w-[calc((100%-2.6rem)/3.6)]"
      aria-label={title}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-secondary">
        {slot.coverVideo ? (
          <video
            src={slot.coverVideo}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
          />
        ) : slot.coverImage ? (
          <img
            src={slot.coverImage}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover/card:scale-[1.03]"
          />
        ) : (
          // 媒体占位（无 coverImage/coverVideo 时兜底）
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_120%_at_30%_20%,color-mix(in_srgb,var(--growth-accent)_10%,transparent),transparent_60%)]">
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <Sparkles className="size-5 text-foreground/20" />
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground/25">
                {title}
              </span>
            </div>
          </div>
        )}
      </div>
      <h3 className="mt-3 text-base font-bold uppercase tracking-wide text-foreground transition-colors duration-300 group-hover/card:text-growth-accent">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </a>
  );
}

/** DB 驱动的首页 hero 横向 rail：由服务端聚合 resolveSlot 结果渲染，视觉与 FeaturedModelsShowcase 一致。 */
export function HomeHeroCuratedBar({ slots }: { slots: ResolvedFeaturedSlot[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = () => {
    const el = railRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, []);

  // 点击移动一格（一张卡片 + 间距）
  const scrollByCard = (direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const cardWidth = first ? first.clientWidth : el.clientWidth * 0.27;
    el.scrollBy({ left: direction * (cardWidth + 16), behavior: 'smooth' });
  };

  return (
    <section className="bg-background py-6 md:py-8">
      <div className="mx-auto max-w-[1920px] px-4 md:px-6">
        <div className="group/rail relative">
          <div
            ref={railRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} />
            ))}
          </div>

          {/* 右侧还有内容时的渐隐阴影 */}
          {canRight ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent" />
          ) : null}
          {canLeft ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent" />
          ) : null}

          {/* 左右切换按钮：可滚动方向 + 悬浮整块才显示，垂直居中于媒体区域，点击移动一格 */}
          {canLeft ? (
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollByCard(-1)}
              className="absolute left-2 top-[calc((100%-3.75rem)/2)] grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground opacity-0 backdrop-blur transition duration-300 hover:bg-background focus-visible:opacity-100 group-hover/rail:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {canRight ? (
            <button
              type="button"
              aria-label="Next"
              onClick={() => scrollByCard(1)}
              className="absolute right-2 top-[calc((100%-3.75rem)/2)] grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground opacity-0 backdrop-blur transition duration-300 hover:bg-background focus-visible:opacity-100 group-hover/rail:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
