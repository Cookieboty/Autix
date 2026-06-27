import {
  ArrowRight,
  Images,
  Layers3,
  Sparkles,
  Video,
} from 'lucide-react';
import { MediaCard, MediaThumb } from './MediaBlocks';
import type {
  PublicGrowthCollection,
  PublicGrowthFeature,
  PublicGrowthMediaItem,
} from './types';

function LoopingTagRow({
  tags,
  reverse = false,
}: {
  tags: Array<{ label: string; href: string }>;
  reverse?: boolean;
}) {
  if (!tags.length) return null;
  const loopTags = [...tags, ...tags, ...tags];

  return (
    <div className="growth-mask-fade overflow-hidden py-1">
      <div
        className={`growth-preset-ribbon flex w-max items-center gap-3 ${
          reverse ? 'growth-preset-ribbon-reverse' : ''
        }`}
      >
        {loopTags.map((tag, index) => (
          <a
            key={`${tag.href}-${index}`}
            href={tag.href}
            className="inline-flex min-h-12 max-w-[260px] items-center gap-3 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold text-white/76 shadow-[0_18px_70px_rgb(0_0_0/0.22)] backdrop-blur transition hover:border-[#c9ff82]/45 hover:bg-[#c9ff82] hover:text-black"
            aria-hidden={index >= tags.length ? true : undefined}
            tabIndex={index >= tags.length ? -1 : undefined}
          >
            <Sparkles className="size-4 shrink-0" />
            <span className="truncate">{tag.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ExploreFeatureCard({
  feature,
  featured = false,
}: {
  feature: PublicGrowthFeature;
  featured?: boolean;
}) {
  return (
    <a
      href={feature.href}
      className={`group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.045] transition duration-300 hover:-translate-y-1 hover:border-white/24 ${
        featured ? 'min-h-[560px]' : 'min-h-[270px]'
      }`}
    >
      {feature.mediaUrl ? (
        <img
          src={feature.mediaUrl}
          alt={feature.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.82] transition duration-700 group-hover:scale-[1.04]"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.9))]" />
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-90"
        style={{ backgroundColor: feature.accent }}
      />
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/12 bg-black/44 px-2 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/78 backdrop-blur">
          <Sparkles className="size-3.5" />
          {feature.badge}
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3
              className={
                featured
                  ? 'text-4xl font-semibold leading-[0.95] text-white md:text-6xl'
                  : 'text-2xl font-semibold leading-tight text-white'
              }
            >
              {feature.title}
            </h3>
            <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6 text-white/62">
              {feature.description}
            </p>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-black transition group-hover:bg-[#c9ff82]">
            <ArrowRight className="size-5" />
          </span>
        </div>
      </div>
    </a>
  );
}

export function ProductExploreSection({
  eyebrow,
  title,
  subtitle,
  features,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: PublicGrowthFeature[];
  items: PublicGrowthMediaItem[];
}) {
  if (!features.length) return null;
  const [primary, ...rest] = features;
  const mediaStack = items.slice(0, 3);

  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#050505] py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:96px_96px]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#c9ff82]">
              {eyebrow}
            </div>
            <h2 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-normal text-white md:text-6xl">
              {title}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-white/58 lg:justify-self-end">
            {subtitle}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
          {primary ? <ExploreFeatureCard feature={primary} featured /> : null}
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {rest.slice(0, 2).map((feature) => (
                <ExploreFeatureCard key={feature.key} feature={feature} />
              ))}
            </div>
            {rest[2] ? <ExploreFeatureCard feature={rest[2]} /> : null}
            {mediaStack.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {mediaStack.map((item, index) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="group relative min-h-44 overflow-hidden rounded-md border border-white/10 bg-black transition duration-300 hover:-translate-y-1 hover:border-white/24"
                    aria-label={item.title}
                  >
                    <MediaThumb
                      item={item}
                      eager={index === 0}
                      autoPlay={index === 0}
                      className="transition duration-700 group-hover:scale-[1.05]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))]" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/42">
                        0{index + 1}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                        {item.title}
                      </h3>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PresetRunway({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  tags,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  tags: Array<{ label: string; href: string }>;
}) {
  return (
    <section className="relative overflow-hidden bg-[#060606] py-16 md:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#c9ff82]">
            {eyebrow}
          </div>
          <h2 className="text-4xl font-semibold leading-[0.96] tracking-normal text-white md:text-7xl">
            {title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58 md:text-lg">
            {subtitle}
          </p>
          <a
            href="/presets"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md border border-white/12 bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-[#c9ff82]"
          >
            <Layers3 className="size-4" />
            {actionLabel}
          </a>
        </div>
      </div>
      <div className="mt-10 grid gap-3">
        <LoopingTagRow tags={tags} />
        <LoopingTagRow tags={[...tags].reverse()} reverse />
      </div>
    </section>
  );
}

export function CommunityCinemaSection({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  feedLabel,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  feedLabel: string;
  items: PublicGrowthMediaItem[];
}) {
  const [lead, sideA, sideB, ...rest] = items;
  const gallery = rest.length ? rest.slice(0, 8) : items.slice(0, 8);

  return (
    <section className="relative overflow-hidden bg-[#030303] py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:100%_72px]" />
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#7dd3fc]">
              {eyebrow}
            </div>
            <h2 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-normal text-white md:text-6xl">
              {title}
            </h2>
          </div>
          <div className="lg:justify-self-end">
            <p className="max-w-xl text-base leading-7 text-white/58">{subtitle}</p>
            <a
              href="/community"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-white/12 px-4 py-2 text-sm font-semibold text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              {actionLabel}
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          {lead ? (
            <a
              href={lead.href}
              className="group relative min-h-[520px] overflow-hidden rounded-md border border-white/12 bg-black shadow-[0_34px_130px_rgb(0_0_0/0.42)] md:min-h-[680px]"
              aria-label={lead.title}
            >
              <MediaThumb
                item={lead}
                eager
                autoPlay
                className="transition duration-700 group-hover:scale-[1.035]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgba(0,0,0,0.9)_100%)]" />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-white/12 bg-black/46 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/72 backdrop-blur">
                <Video className="size-4 text-[#7dd3fc]" />
                {lead.badge || lead.mediaType}
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                <h3 className="max-w-3xl text-4xl font-semibold leading-[0.96] text-white md:text-6xl">
                  {lead.title}
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 md:text-base">
                  {lead.subtitle || lead.description}
                </p>
              </div>
            </a>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {sideA ? <MediaCard item={sideA} priority shape="wide" /> : null}
            {sideB ? <MediaCard item={sideB} priority shape="tall" /> : null}
            <div className="relative min-h-44 overflow-hidden rounded-md border border-white/10 bg-white/[0.045] p-5">
              <div className="mb-8 flex items-center justify-between gap-4">
                <Images className="size-5 text-[#c9ff82]" />
                <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/44">
                  {feedLabel}
                </span>
              </div>
              <div className="text-5xl font-semibold leading-none text-white">{items.length}</div>
              <p className="mt-2 text-sm leading-6 text-white/56">{subtitle}</p>
            </div>
          </div>
        </div>

        {gallery.length ? (
          <div className="mt-3 grid auto-rows-[150px] grid-cols-2 gap-3 md:auto-rows-[210px] md:grid-cols-4">
            {gallery.map((item, index) => (
              <MediaCard
                key={item.id}
                item={item}
                priority={index < 2}
                shape="fill"
                className={index % 6 === 0 ? 'col-span-2 row-span-2' : index % 5 === 2 ? 'col-span-2' : ''}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CollectionSpotlightCard({
  collection,
  featured = false,
}: {
  collection: PublicGrowthCollection;
  featured?: boolean;
}) {
  return (
    <a
      href={`/community/${collection.slug}`}
      className={`group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.045] transition duration-300 hover:-translate-y-1 hover:border-white/24 ${
        featured ? 'min-h-[560px]' : 'min-h-[270px]'
      }`}
    >
      {collection.heroMedia ? (
        <img
          src={collection.heroMedia}
          alt={collection.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.9))]" />
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
        <div className="mb-3 flex flex-wrap gap-2">
          {collection.tags.slice(0, featured ? 4 : 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-white/10 bg-white/12 px-2 py-1 text-xs text-white/78 backdrop-blur"
            >
              {tag}
            </span>
          ))}
        </div>
        <h3 className={featured ? 'text-4xl font-semibold md:text-6xl' : 'text-2xl font-semibold'}>
          {collection.title}
        </h3>
        <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-white/62">
          {collection.description}
        </p>
      </div>
    </a>
  );
}

export function CollectionStageSection({
  eyebrow,
  title,
  subtitle,
  collections,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  collections: PublicGrowthCollection[];
}) {
  if (!collections.length) return null;
  const [featured, ...rest] = collections;

  return (
    <section className="relative overflow-hidden bg-[#070807] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 max-w-4xl">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#fca5a5]">
            {eyebrow}
          </div>
          <h2 className="text-4xl font-semibold leading-[0.98] tracking-normal text-white md:text-6xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/58">{subtitle}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          {featured ? <CollectionSpotlightCard collection={featured} featured /> : null}
          <div className="grid gap-3">
            {rest.slice(0, 2).map((collection) => (
              <CollectionSpotlightCard key={collection.slug} collection={collection} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalHomeCta({
  title,
  description,
  imageLabel,
  videoLabel,
  presetsLabel,
}: {
  title: string;
  description: string;
  imageLabel: string;
  videoLabel: string;
  presetsLabel: string;
}) {
  const links = [
    { label: imageLabel, href: '/ai/image', icon: Images },
    { label: videoLabel, href: '/ai/video', icon: Video },
    { label: presetsLabel, href: '/presets', icon: Layers3 },
  ];

  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#020202]">
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(115deg,rgba(255,255,255,0.12)_0,transparent_24%,transparent_76%,rgba(255,255,255,0.1)_100%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white/42">
              Amux Studio
            </div>
            <h2 className="max-w-4xl text-5xl font-semibold leading-[0.92] tracking-normal text-white md:text-8xl">
              {title}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/58 md:text-lg">
              {description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="group flex min-h-24 items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.055] px-5 py-4 text-lg font-semibold text-white transition duration-300 hover:-translate-y-1 hover:border-[#c9ff82]/40 hover:bg-[#c9ff82] hover:text-black"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
