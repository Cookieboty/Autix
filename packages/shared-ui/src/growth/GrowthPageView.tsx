import { ArrowRight, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getFallbackPage } from './fallback';
import { KineticStepCards, MagneticLink, SpotlightPanel } from './GrowthInteractions';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthPage } from './types';

export function GrowthPageView({ page }: { page?: PublicGrowthPage | null }) {
  const t = useTranslations('publicGrowth');
  const data = page ?? getFallbackPage(t);
  const [primarySection, ...supportSections] = data.sections;

  return (
    <PublicGrowthShell promo={{ label: t('growthPage.promo', { title: data.title }), href: data.ctaHref }}>
      <main>
        <section className="relative min-h-[calc(100svh-8rem)] overflow-hidden border-b border-border">
          <img
            src={data.heroMedia}
            alt={data.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 growth-page-hero-overlay" />
          <div className="pointer-events-none absolute inset-0 opacity-25 growth-grid-noise-page" />
          <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40" />
          <div className="relative mx-auto grid min-h-[calc(100svh-8rem)] max-w-7xl gap-8 px-4 pb-10 pt-24 md:grid-cols-[1fr_420px] md:px-6 md:pb-14">
            <div className="flex max-w-3xl flex-col justify-end">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/75">
                <Sparkles className="size-4 text-growth-accent" />
                {data.eyebrow ?? t('growthPage.fallbackEyebrow')}
              </div>
              <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{data.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70 md:text-lg">{data.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground/78">
                    {tag}
                  </span>
                ))}
              </div>
              <MagneticLink
                href={data.ctaHref ?? '/ai/image'}
                className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-growth-accent-hover"
              >
                {data.ctaLabel ?? t('growthPage.fallbackCta')}
                <ArrowRight className="size-4" />
              </MagneticLink>
            </div>

            <SpotlightPanel className="growth-tilt-card self-end rounded-md border border-border bg-background/46 p-3 growth-content-panel-shadow backdrop-blur-md transition duration-300">
              <div className="overflow-hidden rounded-md border border-border bg-secondary">
                <img
                  src={primarySection?.mediaUrl ?? data.heroMedia}
                  alt={primarySection?.title ?? data.title}
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>
              <div className="mt-3 rounded-md bg-secondary p-4">
                <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
                  <Zap className="size-3.5 text-growth-accent" />
                  {data.tags[0] ?? data.title}
                </div>
                <h2 className="line-clamp-2 text-xl font-semibold">
                  {primarySection?.title ?? data.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/62">
                  {primarySection?.body ?? data.description}
                </p>
              </div>
            </SpotlightPanel>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <KineticStepCards
            sections={supportSections.length ? supportSections : data.sections}
            ctaHref={data.ctaHref}
            fallbackMedia={data.heroMedia}
          />
        </section>
      </main>
    </PublicGrowthShell>
  );
}
