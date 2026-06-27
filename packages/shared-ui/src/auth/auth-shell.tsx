'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AudioLines, BadgeCheck, Gem, Layers3, Sparkles, Video } from 'lucide-react';
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
  title: string;
  description: string;
  label: string;
  badge: string;
  imageUrl?: string;
  accentClassName: string;
  icon: LucideIcon;
};

export function useDefaultAuthPromoSlides(): AuthPromoSlide[] {
  return [
    {
      title: 'NANO BANANA PRO 4K',
      description: 'Best price for premium image generations and studio-grade upscaling.',
      label: 'Nano Banana Pro',
      badge: '4K Resolution',
      accentClassName: 'from-lime-300/35 via-cyan-300/20 to-fuchsia-400/28',
      icon: Gem,
    },
    {
      title: 'KLING 3.0',
      description: 'Cinematic video creation with sharp motion, timing, and scene control.',
      label: 'Kling 3.0',
      badge: 'With Audio',
      accentClassName: 'from-orange-300/28 via-sky-300/18 to-lime-200/18',
      icon: AudioLines,
    },
    {
      title: 'HIGGSFIELD SOUL',
      description: 'Turn references into expressive campaign visuals and repeatable styles.',
      label: 'Higgsfield Soul',
      badge: 'Style Lock',
      accentClassName: 'from-rose-300/28 via-violet-300/20 to-emerald-300/20',
      icon: Sparkles,
    },
    {
      title: 'CINEMATIC APP',
      description: 'Plan shots, build storyboards, and publish reusable creative workflows.',
      label: 'Cinematic App',
      badge: 'Storyboard',
      accentClassName: 'from-blue-300/28 via-slate-100/12 to-amber-300/22',
      icon: Video,
    },
  ];
}

function AuthPromoArtwork({ slide }: { slide: AuthPromoSlide }) {
  if (slide.imageUrl) {
    return (
      <img
        src={slide.imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={cn('absolute inset-0 bg-gradient-to-br', slide.accentClassName)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_16%,rgba(255,255,255,0.56),transparent_22%),radial-gradient(circle_at_82%_38%,rgba(255,255,255,0.22),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(0,0,0,0.72))]" />
      <div className="absolute left-[13%] top-[13%] h-[52%] w-[32%] rounded-[48%] bg-black/42 blur-sm" />
      <div className="absolute left-[19%] top-[20%] h-[22%] w-[26%] rounded-full border border-white/28 bg-white/18 shadow-[0_0_70px_rgba(255,255,255,0.24)]" />
      <div className="absolute left-[35%] top-[20%] h-[10%] w-[46%] -skew-x-12 rounded-full bg-white/32 blur-[2px]" />
      <div className="absolute bottom-[13%] right-[10%] h-[45%] w-[58%] -skew-x-12 rounded-[42px] bg-black/54 shadow-[0_30px_120px_rgba(0,0,0,0.58)]" />
      <div className="absolute bottom-[28%] right-[3%] h-[18%] w-[72%] rotate-[-8deg] rounded-full bg-white/18 blur-sm" />
      <div className="absolute bottom-[8%] left-[5%] h-[38%] w-[74%] rounded-[48%] bg-black/46 blur-xl" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,rgba(0,0,0,0.68)_78%,rgba(0,0,0,0.95)_100%)]" />
      <div className="absolute right-8 top-24 grid size-14 place-items-center rounded-md border border-white/18 bg-white/14 text-white/90 backdrop-blur-md">
        <Layers3 className="size-7" />
      </div>
    </div>
  );
}

export function AuthPromoCarousel({
  className,
  slides,
}: {
  className?: string;
  slides?: AuthPromoSlide[];
}) {
  const defaultSlides = useDefaultAuthPromoSlides();
  const promoSlides = slides?.length ? slides : defaultSlides;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = promoSlides[activeIndex] ?? promoSlides[0];

  useEffect(() => {
    if (promoSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % promoSlides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [promoSlides.length]);

  const progressItems = useMemo(
    () => promoSlides.map((slide, index) => ({ ...slide, index })),
    [promoSlides],
  );

  if (!activeSlide) return null;
  const BadgeIcon = activeSlide.icon;

  return (
    <section
      className={cn(
        'relative hidden min-h-[500px] overflow-hidden rounded-md bg-black text-white lg:block',
        className,
      )}
      aria-label="Creative highlights"
    >
      {promoSlides.map((slide, index) => (
        <div
          key={slide.label}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            index === activeIndex ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden={index !== activeIndex}
        >
          <AuthPromoArtwork slide={slide} />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-0 z-10 p-5">
        <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/16 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(0,0,0,0.32)] backdrop-blur-md">
          <BadgeIcon className="size-4" />
          {activeSlide.badge}
        </div>
        <h2 className="max-w-[640px] text-4xl font-black uppercase leading-[0.96] tracking-normal text-white xl:text-5xl">
          {activeSlide.title}
        </h2>
        <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/62">
          {activeSlide.description}
        </p>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {progressItems.map((slide) => (
            <button
              key={slide.label}
              type="button"
              onClick={() => setActiveIndex(slide.index)}
              className="min-w-0 text-left"
              aria-current={slide.index === activeIndex}
            >
              <span
                className={cn(
                  'mb-2.5 block h-1.5 rounded-full bg-white/18 transition-colors',
                  slide.index === activeIndex && 'bg-white',
                )}
              />
              <span
                className={cn(
                  'block truncate text-xs font-semibold text-white/38 transition-colors',
                  slide.index === activeIndex && 'text-white',
                )}
              >
                {slide.label}
              </span>
            </button>
          ))}
        </div>
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
        'grid min-h-svh bg-[#101214] text-white lg:grid-cols-[minmax(360px,0.9fr)_minmax(500px,1.1fr)]',
        modal &&
          'h-[calc(100svh-3rem)] min-h-0 max-h-[680px] overflow-hidden rounded-md border border-white/10 bg-[#111315] shadow-[0_28px_120px_rgba(0,0,0,0.58)]',
      )}
    >
      <div
        className={cn(
          'relative flex min-h-svh flex-col items-center justify-center px-5 py-7 sm:px-8 lg:px-10',
          modal && 'min-h-0 overflow-y-auto lg:h-full',
        )}
      >
        <div className={cn('w-full max-w-[430px]', modal && 'max-w-[390px]')}>
          {children}
        </div>
      </div>
      <div className={cn('relative p-4 pl-0', modal && 'hidden lg:block')}>
        <AuthPromoCarousel className="h-full min-h-full" />
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute right-8 top-8 z-20 grid size-11 place-items-center rounded-full bg-white/78 text-black/58 shadow-[0_12px_40px_rgba(0,0,0,0.24)] transition hover:bg-white hover:text-black"
          >
            <span className="text-3xl leading-none">&times;</span>
          </button>
        )}
      </div>
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/18 lg:hidden"
        >
          <span className="text-2xl leading-none">&times;</span>
        </button>
      )}
    </div>
  );
}
