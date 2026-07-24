'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { AudioLines, Gem, Sparkles, Video } from 'lucide-react';
import { ThemeLogo } from '../brand';
import { cn } from '../ui/utils';

type AuthBrandMarkProps = {
  alt?: string;
  name?: string;
  size?: number;
  priority?: boolean;
  subtitle?: ReactNode;
};

export function AuthBrandMark({
  alt = 'Amux Studio',
  name = 'Amux Studio',
  size = 28,
  priority = false,
  subtitle,
}: AuthBrandMarkProps) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <ThemeLogo alt={alt} size={size} priority={priority} />
        <span className="text-xl font-bold text-foreground">{name}</span>
      </div>
      {subtitle && <p className="text-foreground/60 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

type AuthFeature = {
  icon: LucideIcon;
  text: ReactNode;
};

type AuthSplitShellProps = {
  brandAlt?: string;
  brandName?: string;
  brandSubtitle?: ReactNode;
  sideTitle: ReactNode;
  sideDescription?: ReactNode;
  sideFooter: ReactNode;
  features?: AuthFeature[];
  mobileSubtitle?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
};

export function AuthSplitShell({
  brandAlt = 'Amux Studio',
  brandName = 'Amux Studio',
  brandSubtitle,
  sideTitle,
  sideDescription,
  sideFooter,
  features,
  mobileSubtitle,
  contentClassName = 'space-y-8',
  children,
}: AuthSplitShellProps) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-background to-secondary">
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <ThemeLogo alt={brandAlt} size={40} priority />
            <div>
              <div className="text-foreground font-bold text-xl">{brandName}</div>
              {brandSubtitle && (
                <div className="text-foreground/60 text-xs">{brandSubtitle}</div>
              )}
            </div>
          </div>
        </div>

        <div className={`relative z-10 ${features?.length ? 'space-y-8' : 'space-y-4'}`}>
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              {sideTitle}
            </h2>
            {sideDescription && (
              <p className="mt-3 text-foreground/60 text-sm leading-relaxed">
                {sideDescription}
              </p>
            )}
          </div>
          {features?.length ? (
            <div className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <div key={String(text)} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/30 border border-primary/30">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground/80 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">{sideFooter}</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className={`w-full max-w-md ${contentClassName}`}>
          <div className="lg:hidden text-center">
            <AuthBrandMark
              alt={brandAlt}
              name={brandName}
              size={28}
              subtitle={mobileSubtitle}
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

type AuthCenteredShellProps = {
  children: ReactNode;
  className?: string;
};

export function AuthCenteredShell({ children, className = 'space-y-8' }: AuthCenteredShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-background">
      <div className={`w-full max-w-md ${className}`}>{children}</div>
    </div>
  );
}

type AuthPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  showBrand?: boolean;
  brandAlt?: string;
  brandName?: string;
};

export function AuthPageHeader({
  title,
  description,
  showBrand = true,
  brandAlt = 'Amux Studio',
  brandName = 'Amux Studio',
}: AuthPageHeaderProps) {
  return (
    <div className="text-center">
      {showBrand && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <ThemeLogo alt={brandAlt} size={28} />
          <span className="text-xl font-bold text-foreground">{brandName}</span>
        </div>
      )}
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {description && (
        <p className="text-foreground/50 text-sm mt-2">{description}</p>
      )}
    </div>
  );
}

export type AuthPromoSlide = {
  /** 大标题，按设计稿全大写展示 */
  title: string;
  description: string;
  /** 底部进度条下方的短标签 */
  label: string;
  badge: string;
  imageUrl?: string;
  /** 视频背景，优先级高于 imageUrl */
  videoUrl?: string;
  icon: LucideIcon;
};

/**
 * 轮播展示的 4 个主推模型。媒体地址与首页 hero rail
 * （growth/home/FeaturedModelsShowcase.tsx 的 FEATURED_MODELS）保持一致，
 * 换素材时两处一起改。
 */
export function useDefaultAuthPromoSlides(): AuthPromoSlide[] {
  return [
    {
      title: 'SEEDANCE 2.0',
      description: 'Cinematic AI video generation — standard and lightning-fast variants.',
      label: 'Seedance 2.0',
      badge: 'Cinematic Video',
      videoUrl: 'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
      icon: Video,
    },
    {
      title: 'GEMINI OMNI FLASH',
      description: 'Generate and edit video from any input, in a single flash.',
      label: 'Gemini Omni Flash',
      badge: 'Omni Input',
      videoUrl: 'https://cdn.amux.ai/background/gemini-omni__page-cover__hero.webm',
      icon: AudioLines,
    },
    {
      title: 'GPT IMAGE 2',
      description: 'Prompt-driven image creation with sharp fidelity.',
      label: 'GPT Image 2',
      badge: 'Sharp Fidelity',
      imageUrl: 'https://cdn.amux.ai/background/16-9-6.webp',
      icon: Sparkles,
    },
    {
      title: 'NANO BANANA PRO',
      description: 'Studio-grade image generation and precise editing.',
      label: 'Nano Banana Pro',
      badge: '4K Resolution',
      imageUrl: 'https://cdn.amux.ai/background/123.webp',
      icon: Gem,
    },
  ];
}

function AuthPromoArtwork({ slide, active }: { slide: AuthPromoSlide; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 不能用 autoPlay：它只在元素挂载那一刻生效，后续 active 由 false 变 true 时
  // 浏览器不会响应，非首张的视频会永远停在第一帧。只能显式 play/pause。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      void video.play().catch(() => {
        /* 自动播放被拦截时保持首帧即可 */
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0b0c0d]">
      {slide.videoUrl ? (
        <video
          ref={videoRef}
          src={slide.videoUrl}
          // 仅当前帧播放，切走即暂停，避免 4 个视频同时解码
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : slide.imageUrl ? (
        <img src={slide.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {/* 底部压暗，保证标题/描述可读 */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgba(0,0,0,0.55)_68%,rgba(0,0,0,0.9)_100%)]" />
    </div>
  );
}

/** 单张停留时长，同时也是底部进度条走满一格的时长 */
const SLIDE_DURATION_MS = 4200;

export function AuthPromoCarousel({
  className,
  slides,
}: {
  className?: string;
  slides?: AuthPromoSlide[];
}) {
  const t = useTranslations('auth');
  const defaultSlides = useDefaultAuthPromoSlides();
  const promoSlides = slides?.length ? slides : defaultSlides;
  const total = promoSlides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  // 进度条填充：切片后先归零，再在下一帧展开到 100%，靠 CSS transition 走满，
  // 免去 rAF 逐帧 setState。
  const [progressFilled, setProgressFilled] = useState(false);

  // 用 timeout + activeIndex 依赖而非固定 interval：手动点某一格时计时重新开始，
  // 进度条不会走到一半就被切走。
  useEffect(() => {
    if (total <= 1) return undefined;
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % total);
    }, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [total, activeIndex]);

  useEffect(() => {
    setProgressFilled(false);
    // 双 rAF：确保「宽度归零」这一帧先真正落到 DOM，否则浏览器会合并成一次样式计算，
    // transition 不触发，进度条会直接停在满格。
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setProgressFilled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [activeIndex]);

  const progressItems = useMemo(
    () => promoSlides.map((slide, index) => ({ ...slide, index })),
    [promoSlides],
  );

  if (total === 0) return null;

  return (
    <section
      className={cn(
        'relative hidden min-h-[500px] overflow-hidden rounded-2xl bg-black text-white lg:block',
        className,
      )}
      aria-label={t('creativeHighlights')}
    >
      {/* 图文整块淡入淡出 */}
      {promoSlides.map((slide, index) => {
        const BadgeIcon = slide.icon;
        const isActive = index === activeIndex;
        return (
          <div
            key={slide.label}
            className={cn(
              'absolute inset-0 transition-opacity duration-700',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={!isActive}
          >
            <AuthPromoArtwork slide={slide} active={isActive} />
            {/* pb 给底部固定的进度条导航让位 */}
            <div className="absolute inset-x-0 bottom-0 z-10 p-6 pb-[104px]">
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                <BadgeIcon className="size-3.5" />
                {slide.badge}
              </div>
              <h2 className="max-w-[640px] text-[34px] font-black uppercase leading-[0.98] tracking-tight text-white xl:text-[40px]">
                {slide.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/70">
                {slide.description}
              </p>
            </div>
          </div>
        );
      })}

      <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-3 p-6">
        {progressItems.map((slide) => {
          const isActive = slide.index === activeIndex;
          return (
            <button
              key={slide.label}
              type="button"
              onClick={() => setActiveIndex(slide.index)}
              className="min-w-0 text-left"
              aria-current={isActive}
            >
              {/* 斜切的棱角进度条：外层做倾斜，内层填充跟着切成菱形 */}
              <span className="mb-3 block h-1 -skew-x-[30deg] overflow-hidden bg-white/25">
                <span
                  className="block h-full bg-white transition-[width] ease-linear"
                  style={{
                    width: isActive ? (progressFilled ? '100%' : '0%') : '0%',
                    transitionDuration: isActive && progressFilled ? `${SLIDE_DURATION_MS}ms` : '0ms',
                  }}
                />
              </span>
              <span
                className={cn(
                  'block truncate text-xs font-medium text-white/45 transition-colors',
                  isActive && 'font-semibold text-white',
                )}
              >
                {slide.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function AuthExperienceShell({
  children,
  modal = false,
  showClose = false,
  onClose,
  closeLabel = 'Close',
}: {
  children: ReactNode;
  modal?: boolean;
  showClose?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div
      className={cn(
        // 表单在左、媒体在右；lg 以下只保留表单
        'relative grid min-h-svh bg-[#0e0f11] text-white lg:grid-cols-[minmax(440px,1fr)_minmax(440px,1fr)]',
        modal &&
          // 与导航 Image 下拉（ImageNavFlyout）同一套毛玻璃底色
          'h-[calc(100svh-3rem)] min-h-0 max-h-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(28,30,32,0.86)] backdrop-blur-[32px] shadow-[0_28px_120px_rgba(0,0,0,0.58)]',
      )}
    >
      <div
        className={cn(
          'relative flex min-h-svh flex-col items-center justify-center px-5 py-10 sm:px-8 lg:px-10',
          modal && 'min-h-0 overflow-y-auto py-8 lg:h-full',
        )}
      >
        <div className={cn('w-full max-w-[430px]', modal && 'max-w-[384px]')}>
          {children}
        </div>
      </div>
      <div className={cn('relative p-3 pl-0', modal && 'hidden lg:block')}>
        <AuthPromoCarousel className="h-full min-h-full" />
      </div>
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          // 压在右侧图片上，用暗底毛玻璃保证任何画面下都看得清
          className="absolute right-5 top-5 z-20 grid size-8 place-items-center rounded-full bg-black/45 text-white/80 backdrop-blur-md transition hover:bg-black/70 hover:text-white"
        >
          <span className="text-lg leading-none">&times;</span>
        </button>
      )}
    </div>
  );
}
