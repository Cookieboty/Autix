import {
  ArrowRight,
  Images,
  Video,
} from 'lucide-react';
import { MediaThumb } from '../MediaBlocks';
import type { PublicGrowthMediaItem } from '../types';
import { HomeSectionIntro, releaseDetail } from './home-parts';

function ReleaseBadge({ item }: { item: PublicGrowthMediaItem }) {
  const Icon = item.mediaType === 'video' ? Video : Images;
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background/50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{item.badge || item.mediaType}</span>
    </span>
  );
}

function ReleaseCard({
  item,
  priority = false,
  hero = false,
}: {
  item: PublicGrowthMediaItem;
  priority?: boolean;
  hero?: boolean;
}) {
  const detail = releaseDetail(item);
  const visibleTags = item.tags.slice(0, hero ? 3 : 2);

  return (
    <a
      href={item.href}
      className={`growth-release-card-shadow group relative block overflow-hidden rounded-md border border-border bg-secondary transition duration-500 hover:-translate-y-1 hover:border-input ${
        hero ? 'min-h-[440px] md:min-h-[520px]' : 'min-h-[238px]'
      }`}
      aria-label={item.title}
    >
      <MediaThumb
        item={item}
        eager={priority}
        autoPlay={priority}
        className="absolute inset-0 transition duration-[900ms] group-hover:scale-[1.035]"
      />
      <div className="growth-release-card-overlay absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-px bg-foreground/30 opacity-0 transition duration-500 group-hover:opacity-100" />
      <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)]">
        <ReleaseBadge item={item} />
      </div>
      <div className={hero ? 'absolute inset-x-0 bottom-0 p-5 md:p-7' : 'absolute inset-x-0 bottom-0 p-4'}>
        {visibleTags.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <span key={tag} className="rounded-md bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3
              className={
                hero
                  ? 'line-clamp-2 text-2xl font-semibold leading-[1.05] text-foreground md:text-4xl'
                  : 'line-clamp-2 text-lg font-semibold leading-tight text-foreground'
              }
            >
              {item.title}
            </h3>
            {detail ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {detail}
              </p>
            ) : null}
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:bg-growth-accent">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </a>
  );
}

export function HomeReleaseGallery({
  eyebrow,
  title,
  subtitle,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: PublicGrowthMediaItem[];
}) {
  const releaseItems = items.slice(0, 7);
  const [lead, second, third, ...stripItems] = releaseItems;
  if (!lead) return null;

  return (
    <section className="relative overflow-hidden border-y border-border bg-background py-12 md:py-20">
      <div className="growth-rb-ambient pointer-events-none absolute inset-0 opacity-70" />
      <div className="growth-grid-noise-lg pointer-events-none absolute inset-0 opacity-[0.1]" />
      <div className="relative mx-auto max-w-[1920px] px-4 md:px-6">
        <HomeSectionIntro eyebrow={eyebrow} title={title} subtitle={subtitle} />

        <div className="grid gap-3 lg:grid-cols-[1.16fr_0.84fr]">
          <ReleaseCard item={lead} priority hero />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {second ? <ReleaseCard item={second} priority /> : null}
            {third ? <ReleaseCard item={third} /> : null}
          </div>
        </div>

        {stripItems.length ? (
          <div className="growth-release-strip mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stripItems.map((item, index) => (
              <a
                key={item.id}
                href={item.href}
                className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-secondary transition duration-500 hover:-translate-y-1 hover:border-input md:aspect-[16/10]"
                aria-label={item.title}
              >
                <MediaThumb
                  item={item}
                  eager={index === 0}
                  autoPlay={false}
                  className="transition duration-[900ms] group-hover:scale-[1.04]"
                />
                <div className="growth-strip-card-overlay absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="mb-2 h-1 w-7 rounded-full bg-growth-accent" />
                  <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                    {item.title}
                  </h3>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
