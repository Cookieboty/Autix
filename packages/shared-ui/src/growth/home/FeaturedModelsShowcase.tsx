'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

type FeaturedModel = {
  id: string;
  title: string;
  description: string;
  /** 跳转地址（先留空，模型上线后统一补） */
  href: string;
  /** 图片背景（留空待补） */
  image?: string;
  /** 视频背景（留空待补），优先级高于 image */
  video?: string;
};

// 展示的先进模型；媒体背景与跳转先留空，后续逐个补上。描述为占位文案，可再调整。
const FEATURED_MODELS: FeaturedModel[] = [
  {
    id: 'seedance-2',
    title: 'Seedance 2.0',
    description: 'Cinematic AI video generation — standard and lightning-fast variants.',
    href: '',
    video: 'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
  },
  {
    id: 'gemini-omni-flash',
    title: 'Gemini Omni Flash',
    description: 'Generate and edit video from any input, in a single flash.',
    href: '',
    video: 'https://cdn.amux.ai/background/gemini-omni__page-cover__hero.webm',
  },
  {
    id: 'nano-banana-2-lite',
    title: 'Nano Banana 2 Lite',
    description: 'Rapid generation with sharp in-image text.',
    href: '',
    image: 'https://cdn.amux.ai/background/unnamed.webp',
  },
  {
    id: 'nano-banana-pro',
    title: 'Nano Banana Pro',
    description: 'Studio-grade image generation and precise editing.',
    href: '',
    image: 'https://cdn.amux.ai/background/123.webp',
  },
  {
    id: 'nano-banana-2',
    title: 'Nano Banana 2',
    description: 'Balanced quality and speed for everyday visuals.',
    href: '',
    image: 'https://cdn.amux.ai/background/456.webp',
  },
  {
    id: 'gpt-image-2',
    title: 'GPT Image 2',
    description: 'Prompt-driven image creation with sharp fidelity.',
    href: '',
    image: 'https://cdn.amux.ai/background/16-9-6.webp',
  },
  {
    id: 'seedream-5-lite',
    title: 'Seedream 5 Lite',
    description: 'Fast, expressive image generation at scale.',
    href: '',
    image:
      'https://cdn.amux.ai/background/e71ada1e05b011f1bd68b8599f1d1fe2~tplv-d77oumduh0-watermark_ai.jpg',
  },
  {
    id: 'seedream-4-5',
    title: 'SeedReam 4.5',
    description: 'High-fidelity images with rich, detailed texture.',
    href: '',
    image:
      'https://cdn.amux.ai/background/a1104d22cdfd11f0ba0900163e56377f~tplv-d77oumduh0-watermark_ai.jpg',
  },
];

function ModelCard({ model }: { model: FeaturedModel }) {
  return (
    <a
      href={model.href}
      className="group/card w-[80%] shrink-0 snap-start sm:w-[42%] lg:w-[calc((100%-2.6rem)/3.6)]"
      aria-label={model.title}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-secondary">
        {model.video ? (
          <video
            src={model.video}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
          />
        ) : model.image ? (
          <img
            src={model.image}
            alt={model.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover/card:scale-[1.03]"
          />
        ) : (
          // 媒体占位（待补图片/视频）
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_120%_at_30%_20%,color-mix(in_srgb,var(--growth-accent)_10%,transparent),transparent_60%)]">
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <Sparkles className="size-5 text-foreground/20" />
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground/25">
                {model.title}
              </span>
            </div>
          </div>
        )}
      </div>
      <h3 className="mt-3 text-base font-bold uppercase tracking-wide text-foreground transition-colors duration-300 group-hover/card:text-growth-accent">
        {model.title}
      </h3>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{model.description}</p>
    </a>
  );
}

export function FeaturedModelsShowcase() {
  const t = useTranslations('publicGrowth.home');
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
            {FEATURED_MODELS.map((model) => (
              <ModelCard key={model.id} model={model} />
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
              aria-label={t('prev')}
              onClick={() => scrollByCard(-1)}
              className="absolute left-2 top-[calc((100%-3.75rem)/2)] grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground opacity-0 backdrop-blur transition duration-300 hover:bg-background focus-visible:opacity-100 group-hover/rail:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {canRight ? (
            <button
              type="button"
              aria-label={t('next')}
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
