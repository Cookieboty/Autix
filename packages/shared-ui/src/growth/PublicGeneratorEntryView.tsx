import { ArrowRight, Images, SlidersHorizontal, Video, WandSparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getFallbackItems } from './fallback';
import { MagneticLink, SpotlightPanel } from './GrowthInteractions';
import { MediaMasonryGrid, MediaRail, MediaThumb } from './MediaBlocks';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthMediaItem } from './types';

function GeneratorPreviewDeck({
  items,
  isVideo,
}: {
  items: PublicGrowthMediaItem[];
  isVideo: boolean;
}) {
  const [featured, second, third] = items;
  if (!featured) return null;
  const supportItems = [second, third].filter(
    (item): item is PublicGrowthMediaItem => Boolean(item),
  );

  return (
    <SpotlightPanel className="relative min-h-[500px] rounded-md border border-white/10 bg-[#0a0d0b] p-3 shadow-[0_30px_110px_rgb(0_0_0/0.42)]">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />
      <a
        href={featured.href}
        className="group relative block h-[360px] overflow-hidden rounded-md border border-white/12 bg-white/[0.05]"
      >
        <MediaThumb
          item={featured}
          eager
          autoPlay
          className="transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.84))]" />
        <div className="absolute left-3 top-3 rounded-md bg-[#c9ff82] px-2 py-1 text-[11px] font-semibold text-black">
          {isVideo ? 'Seedance' : 'Nano'}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="line-clamp-2 text-2xl font-semibold">{featured.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/62">
            {featured.subtitle || featured.description}
          </p>
        </div>
      </a>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {supportItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="group relative block aspect-[4/5] overflow-hidden rounded-md border border-white/10 bg-white/[0.05]"
          >
            <MediaThumb item={item} className="transition duration-700 group-hover:scale-[1.05]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))]" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="line-clamp-2 text-sm font-semibold">{item.title}</div>
            </div>
          </a>
        ))}
      </div>
    </SpotlightPanel>
  );
}

export function PublicGeneratorEntryView({
  kind,
  examples,
}: {
  kind: 'image' | 'video';
  examples?: PublicGrowthMediaItem[] | null;
}) {
  const t = useTranslations('publicGrowth');
  const isVideo = kind === 'video';
  const Icon = isVideo ? Video : Images;
  const title = isVideo ? t('generator.videoTitle') : t('generator.imageTitle');
  const workbenchHref = isVideo ? '/workbench/video' : '/workbench/image';
  const items = examples?.length ? examples : getFallbackItems(t);

  return (
    <PublicGrowthShell promo={{ label: t('generator.promo', { title }), href: workbenchHref }}>
      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-[#050505]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:70px_70px]" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[0.8fr_1.2fr] md:px-6 md:py-16">
            <div className="self-end">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/72">
                <Icon className="size-4 text-[#c9ff82]" />
                {t('generator.eyebrow')}
              </div>
              <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 md:text-lg">
                {isVideo
                  ? t('generator.videoDescription')
                  : t('generator.imageDescription')}
              </p>
              <MagneticLink
                href={workbenchHref}
                className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#c9ff82]"
              >
                {t('generator.generateInWorkbench')}
                <ArrowRight className="size-4" />
              </MagneticLink>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <GeneratorPreviewDeck items={items} isVideo={isVideo} />
              <form className="growth-tilt-card self-end rounded-md border border-white/10 bg-white/[0.05] p-4 shadow-[0_24px_90px_rgb(0_0_0/0.32)] backdrop-blur-md transition duration-300">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/75">
                  <SlidersHorizontal className="size-4 text-[#c9ff82]" />
                  {t('generator.parameters')}
                </div>
                <label className="grid gap-2 text-sm text-white/62">
                  {t('generator.prompt')}
                  <textarea
                    className="min-h-28 resize-none rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none"
                    placeholder={
                      isVideo
                        ? t('generator.promptVideoPlaceholder')
                        : t('generator.promptImagePlaceholder')
                    }
                    readOnly
                  />
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    [
                      t('generator.model'),
                      isVideo ? t('generator.videoModelValue') : t('generator.imageModelValue'),
                    ],
                    [t('generator.ratio'), isVideo ? '16:9' : '1:1'],
                    [t('generator.quality'), t('generator.studio')],
                    [t('generator.visibility'), t('generator.privateFirst')],
                  ].map(([label, value]) => (
                    <div key={label} className="relative overflow-hidden rounded-md border border-white/10 bg-black px-3 py-2">
                      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,#c9ff82,transparent)]" />
                      <div className="text-xs text-white/45">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>
                <MagneticLink
                  href={workbenchHref}
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#c9ff82] px-4 py-2 text-sm font-semibold text-black hover:bg-white"
                >
                  <WandSparkles className="size-4" />
                  {t('generator.createPrivately')}
                </MagneticLink>
              </form>
            </div>
          </div>
        </section>

        <MediaRail items={items} label={t('generator.examplesEyebrow')} />

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff82]">
              {t('generator.examplesEyebrow')}
            </div>
            <h2 className="text-3xl font-semibold md:text-4xl">{t('generator.examplesTitle')}</h2>
          </div>
          <MediaMasonryGrid items={items} variant={isVideo ? 'showcase' : 'rhythm'} />
        </section>
      </main>
    </PublicGrowthShell>
  );
}
