'use client';

import { ArrowRight, Gift, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PointsPackage } from '@autix/shared-store';
import { formatCurrency } from '../../format';
import { MagneticLink } from '../GrowthInteractions';
import { formatCount, pointsPerDollar } from '../public-pricing-helpers';

const FALLBACK_CODE_MAP: Record<string, 'trial' | 'standard' | 'pro' | 'team'> = {
  trial_topup: 'trial',
  standard_topup: 'standard',
  pro_topup: 'pro',
  team_topup: 'team',
};

function TopUpCard({ pkg }: { pkg: PointsPackage }) {
  const t = useTranslations('publicGrowth.pricing');
  const creditUnit = t('creditUnit');

  const fallbackKey = pkg.id.startsWith('fallback-') && pkg.code
    ? FALLBACK_CODE_MAP[pkg.code]
    : undefined;

  const displayName = fallbackKey === 'trial' ? t('topupFallback.trial.name')
    : fallbackKey === 'standard' ? t('topupFallback.standard.name')
    : fallbackKey === 'pro' ? t('topupFallback.pro.name')
    : fallbackKey === 'team' ? t('topupFallback.team.name')
    : pkg.name;

  const displayDescription = fallbackKey === 'trial' ? t('topupFallback.trial.description')
    : fallbackKey === 'standard' ? t('topupFallback.standard.description')
    : fallbackKey === 'pro' ? t('topupFallback.pro.description')
    : fallbackKey === 'team' ? t('topupFallback.team.description')
    : (pkg.description ?? '');

  return (
    <MagneticLink
      href="/membership/packages"
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition duration-300 hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-lg border border-white/8 bg-white/5 text-growth-accent">
          <Gift className="size-5" />
        </span>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-foreground/45">
          {t('validDays', { days: pkg.validityDays ?? 180 })}
        </span>
      </div>

      <h3 className="text-base font-bold text-foreground">{displayName}</h3>
      <p className="mt-1 min-h-9 text-xs leading-5 text-foreground/50 line-clamp-2">
        {displayDescription}
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-foreground">{formatCount(pkg.points)}</span>
          <span className="text-xs font-medium text-foreground/45">{creditUnit}</span>
        </div>
        <div className="mt-1 text-lg font-bold text-foreground/85">{formatCurrency(pkg.price)}</div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-foreground/45">
        <Zap className="size-3.5 text-growth-accent/80" />
        {t('pointsPerDollar', { ratio: pointsPerDollar(pkg) })}
      </div>
    </MagneticLink>
  );
}

export function TopUpSection({ packages }: { packages: PointsPackage[] }) {
  const t = useTranslations('publicGrowth.pricing');

  return (
    <section className="mx-auto max-w-6xl px-4 pt-24 pb-16 md:px-6">
      <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
            {t('topUpTitle')}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/60">
            {t('topUpBody')}
          </p>
        </div>
        <MagneticLink
          href="/membership/packages"
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md border border-foreground/14 bg-foreground/[0.06] px-4 text-sm font-semibold text-foreground transition hover:bg-foreground/10"
        >
          {t('topUpCta')}
          <ArrowRight className="size-4" />
        </MagneticLink>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {packages.slice(0, 4).map((pkg) => (
          <TopUpCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </section>
  );
}
