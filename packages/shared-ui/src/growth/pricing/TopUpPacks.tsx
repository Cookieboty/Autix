'use client';

import { ArrowRight, Clock, Gift, Minus, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PointsPackage } from '@autix/shared-store';
import { formatCurrency } from '../../format';
import { MagneticLink } from '../GrowthInteractions';
import { PLAN_ACCENTS, formatCount, pointsPerDollar } from '../public-pricing-helpers';

const FALLBACK_CODE_MAP: Record<string, 'trial' | 'standard' | 'pro' | 'team'> = {
  trial_topup: 'trial',
  standard_topup: 'standard',
  pro_topup: 'pro',
  team_topup: 'team',
};

function TopUpCard({ pkg, index }: { pkg: PointsPackage; index: number }) {
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
      className="group rounded-2xl border border-foreground/10 bg-foreground/[0.045] p-5 transition duration-300 hover:border-foreground/22 hover:bg-foreground/[0.07]"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div
          className="flex size-10 items-center justify-center rounded-full bg-foreground/[0.08]"
          style={{ color: PLAN_ACCENTS[(index + 2) % PLAN_ACCENTS.length] }}
        >
          <Gift className="size-5" />
        </div>
        <span className="text-xs text-foreground/42">
          {t('validDays', { days: pkg.validityDays ?? 180 })}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-foreground">{displayName}</h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-foreground/54">{displayDescription}</p>
      <div className="mt-5 border-y border-foreground/10 py-4">
        <p className="text-3xl font-semibold text-foreground">
          {formatCount(pkg.points)} <span className="text-sm text-foreground/46">{creditUnit}</span>
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground/84">{formatCurrency(pkg.price)}</p>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-foreground/58">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-foreground/34" />
          {t('pointsPerDollar', { ratio: pointsPerDollar(pkg) })}
        </div>
        <div className="flex items-center gap-2">
          <Minus className="size-4 text-foreground/34" />
          {t('noPerks')}
        </div>
      </div>
    </MagneticLink>
  );
}

export function TopUpSection({ packages }: { packages: PointsPackage[] }) {
  const t = useTranslations('publicGrowth.pricing');

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-14">
      <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="growth-pricing-topup-eyebrow mb-3 inline-flex items-center gap-2 text-sm font-semibold">
            <Package className="size-4" />
            {t('topUpMembershipOnly')}
          </p>
          <h2 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
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
        {packages.slice(0, 4).map((pkg, index) => (
          <TopUpCard key={pkg.id} pkg={pkg} index={index} />
        ))}
      </div>
    </section>
  );
}
