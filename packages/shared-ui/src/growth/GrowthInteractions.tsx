'use client';

import {
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { PublicGrowthCollection, PublicGrowthPage } from './types';

function useMagneticMotion(strength = 0.18) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  return {
    offset,
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setOffset({
        x: (event.clientX - centerX) * strength,
        y: (event.clientY - centerY) * strength,
      });
    },
    onPointerLeave: () => setOffset({ x: 0, y: 0 }),
  };
}

export function MagneticLink({
  children,
  className = '',
  strength,
  style,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  strength?: number;
}) {
  const motion = useMagneticMotion(strength);

  return (
    <a
      {...props}
      className={`growth-magnetic ${className}`}
      style={{
        ...style,
        '--growth-magnetic-x': `${motion.offset.x}px`,
        '--growth-magnetic-y': `${motion.offset.y}px`,
      } as CSSProperties}
      onPointerMove={(event) => {
        motion.onPointerMove(event);
        props.onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        motion.onPointerLeave();
        props.onPointerLeave?.(event);
      }}
    >
      {children}
    </a>
  );
}

export function MagneticButton({
  children,
  className = '',
  strength,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  strength?: number;
}) {
  const motion = useMagneticMotion(strength);

  return (
    <button
      {...props}
      className={`growth-magnetic ${className}`}
      style={{
        ...style,
        '--growth-magnetic-x': `${motion.offset.x}px`,
        '--growth-magnetic-y': `${motion.offset.y}px`,
      } as CSSProperties}
      onPointerMove={(event) => {
        motion.onPointerMove(event);
        props.onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        motion.onPointerLeave();
        props.onPointerLeave?.(event);
      }}
    >
      {children}
    </button>
  );
}

export function SpotlightPanel({
  children,
  className = '',
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  const [position, setPosition] = useState({ x: 50, y: 50 });

  return (
    <div
      className={`growth-spotlight-panel ${className}`}
      style={{
        ...(accent !== undefined ? { '--growth-accent': accent } : {}),
        '--growth-x': `${position.x}%`,
        '--growth-y': `${position.y}%`,
      } as CSSProperties}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      }}
    >
      {children}
    </div>
  );
}

export function InteractiveCollectionBands({
  collections,
  ctaLabel,
}: {
  collections: PublicGrowthCollection[];
  ctaLabel: string;
}) {
  const [activeSlug, setActiveSlug] = useState(collections[0]?.slug ?? '');
  const active = useMemo(
    () => collections.find((collection) => collection.slug === activeSlug) ?? collections[0],
    [activeSlug, collections],
  );

  if (!collections.length) return null;

  return (
    <SpotlightPanel className="grid gap-4 rounded-md border border-border bg-secondary p-3 md:grid-cols-[1fr_380px]">
      <div className="grid gap-2">
        {collections.map((collection, index) => {
          const isActive = collection.slug === active?.slug;
          return (
            <a
              key={collection.slug}
              href={`/community/${collection.slug}`}
              className={`group relative overflow-hidden rounded-md border px-4 py-4 transition duration-300 ${
                isActive
                  ? 'border-growth-accent/40 bg-accent'
                  : 'border-border bg-background/24 hover:border-input hover:bg-secondary'
              }`}
              onMouseEnter={() => setActiveSlug(collection.slug)}
              onFocus={() => setActiveSlug(collection.slug)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 text-xs font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h2 className="text-2xl font-semibold tracking-normal md:text-3xl">
                    {collection.title}
                  </h2>
                  {collection.description ? (
                    <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {collection.description}
                    </p>
                  ) : null}
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-secondary text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowRight className="size-4" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {collection.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          );
        })}
      </div>

      <aside className="relative min-h-[420px] overflow-hidden rounded-md border border-border bg-background">
        {active?.heroMedia ? (
          <img
            src={active.heroMedia}
            alt={active.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-700"
          />
        ) : null}
        <div className="growth-collection-aside-overlay absolute inset-0" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md bg-background/55 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
          <Sparkles className="size-3.5 text-growth-accent" />
          {ctaLabel}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="text-3xl font-semibold">{active?.title}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {active?.description}
          </p>
        </div>
      </aside>
    </SpotlightPanel>
  );
}

export function KineticStepCards({
  sections,
  ctaHref,
  fallbackMedia,
}: {
  sections: PublicGrowthPage['sections'];
  ctaHref?: string;
  fallbackMedia: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = sections[activeIndex] ?? sections[0];
  if (!sections.length) return null;

  return (
    <SpotlightPanel className="grid gap-4 rounded-md border border-border bg-secondary p-3 lg:grid-cols-[0.9fr_1.1fr]">
      <a
        href={active?.href ?? ctaHref ?? '/ai/image'}
        className="group relative min-h-[460px] overflow-hidden rounded-md border border-border bg-background"
      >
        <img
          src={active?.mediaUrl ?? fallbackMedia}
          alt={active?.title ?? ''}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="growth-step-card-overlay absolute inset-0" />
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="mb-3 inline-flex rounded-md bg-growth-accent px-2 py-1 text-xs font-semibold text-primary-foreground">
            {String(activeIndex + 1).padStart(2, '0')}
          </div>
          <h2 className="text-3xl font-semibold md:text-4xl">{active?.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{active?.body}</p>
        </div>
      </a>

      <div className="grid gap-2">
        {sections.map((section, index) => {
          const isActive = index === activeIndex;
          return (
            <a
              key={`${section.title}-${index}`}
              href={section.href ?? ctaHref ?? '/ai/image'}
              className={`group relative overflow-hidden rounded-md border p-4 transition duration-300 ${
                isActive
                  ? 'min-h-36 border-growth-accent/40 bg-accent'
                  : 'min-h-28 border-border bg-background/24 hover:border-input hover:bg-secondary'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <div className="flex items-start gap-4">
                <div className="text-xs font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold">{section.title}</h3>
                  <p className={`mt-2 text-sm leading-6 text-muted-foreground ${isActive ? 'line-clamp-3' : 'line-clamp-2'}`}>
                    {section.body}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
              </div>
            </a>
          );
        })}
      </div>
    </SpotlightPanel>
  );
}
