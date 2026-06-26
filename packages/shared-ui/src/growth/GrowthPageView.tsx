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
        <section className="relative min-h-[calc(100svh-8rem)] overflow-hidden border-b border-white/10">
          <img
            src={data.heroMedia}
            alt={data.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92),rgba(0,0,0,0.56),rgba(0,0,0,0.18))]" />
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40" />
          <div className="relative mx-auto grid min-h-[calc(100svh-8rem)] max-w-7xl gap-8 px-4 pb-10 pt-24 md:grid-cols-[1fr_420px] md:px-6 md:pb-14">
            <div className="flex max-w-3xl flex-col justify-end">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
                <Sparkles className="size-4 text-[#c9ff82]" />
                {data.eyebrow ?? t('growthPage.fallbackEyebrow')}
              </div>
              <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{data.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 md:text-lg">{data.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-white/12 px-3 py-2 text-sm text-white/78">
                    {tag}
                  </span>
                ))}
              </div>
              <MagneticLink
                href={data.ctaHref ?? '/ai/image'}
                className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#c9ff82]"
              >
                {data.ctaLabel ?? t('growthPage.fallbackCta')}
                <ArrowRight className="size-4" />
              </MagneticLink>
            </div>

            <SpotlightPanel className="growth-tilt-card self-end rounded-md border border-white/12 bg-black/46 p-3 shadow-[0_24px_90px_rgb(0_0_0/0.38)] backdrop-blur-md transition duration-300">
              <div className="overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                <img
                  src={primarySection?.mediaUrl ?? data.heroMedia}
                  alt={primarySection?.title ?? data.title}
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>
              <div className="mt-3 rounded-md bg-white/[0.06] p-4">
                <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  <Zap className="size-3.5 text-[#c9ff82]" />
                  {data.tags[0] ?? data.title}
                </div>
                <h2 className="line-clamp-2 text-xl font-semibold">
                  {primarySection?.title ?? data.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/62">
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
