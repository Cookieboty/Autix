import { ArrowRight, BadgeDollarSign, Check, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MagneticLink, SpotlightPanel } from './GrowthInteractions';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { MembershipLevel, MembershipPlan } from '@autix/shared-store';

function pickDisplayPlan(level: MembershipLevel): MembershipPlan | null {
  return level.plans.find((plan) => plan.billingCycle === 'MONTHLY' && plan.autoRenew)
    ?? level.plans.find((plan) => plan.billingCycle === 'MONTHLY')
    ?? level.plans[0]
    ?? null;
}

function formatPrice(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return String(value ?? '$0');
  return `$${parsed.toFixed(parsed % 1 === 0 ? 0 : 2)}`;
}

function featureList(level: MembershipLevel, fallback: string[]) {
  if (Array.isArray(level.features)) {
    return level.features.filter((feature): feature is string => typeof feature === 'string' && feature.length > 0).slice(0, 4);
  }
  return fallback;
}

export function PublicPricingView({ levels }: { levels?: MembershipLevel[] | null }) {
  const t = useTranslations('publicGrowth.pricing');
  const fallbackPlans = [
    {
      name: t('plans.starter.name'),
      price: '$0',
      badge: t('plans.starter.badge'),
      href: '/register',
      points: 0,
      features: [
        t('plans.starter.features.browsing'),
        t('plans.starter.features.drafts'),
        t('plans.starter.features.discovery'),
      ],
    },
    {
      name: t('plans.creator.name'),
      price: '$19',
      badge: t('plans.creator.badge'),
      href: '/membership/upgrade',
      points: 0,
      features: [
        t('plans.creator.features.credits'),
        t('plans.creator.features.pages'),
        t('plans.creator.features.profile'),
      ],
    },
    {
      name: t('plans.studio.name'),
      price: '$79',
      badge: t('plans.studio.badge'),
      href: '/membership/upgrade',
      points: 0,
      features: [
        t('plans.studio.features.batches'),
        t('plans.studio.features.limits'),
        t('plans.studio.features.priority'),
      ],
    },
  ];
  const fallbackFeatures = fallbackPlans.flatMap((plan) => plan.features);
  const livePlans = (levels ?? [])
    .filter((level) => level.isActive !== false)
    .sort((a, b) => (a.sort ?? a.level) - (b.sort ?? b.level))
    .map((level, index) => {
      const plan = pickDisplayPlan(level);
      const displayPrice = plan?.firstTimePrice ?? plan?.price ?? level.monthlyPrice;
      const isFree = Number(displayPrice) <= 0 || level.level <= 0;
      return {
        name: level.name,
        price: formatPrice(displayPrice),
        badge: plan?.discountLabel ?? plan?.firstTimeLabel ?? fallbackPlans[index]?.badge ?? level.name,
        href: isFree ? '/register' : '/membership/upgrade',
        points: plan?.points ?? level.pointsPerMonth,
        features: featureList(level, fallbackPlans[index]?.features ?? fallbackFeatures.slice(0, 3)),
      };
    });
  const plans = livePlans.length ? livePlans : fallbackPlans;
  const heroPlan = plans[1] ?? plans[0];

  return (
    <PublicGrowthShell promo={{ label: t('promo'), href: '/membership/upgrade' }}>
      <main>
        <section className="relative overflow-hidden border-b border-white/10 bg-[#050505]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-[1fr_420px] md:px-6 md:py-18">
            <div className="self-end">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/70">
                <BadgeDollarSign className="size-4 text-[#c9ff82]" />
                {t('eyebrow')}
              </div>
              <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{t('title')}</h1>
              <p className="mt-5 text-base leading-7 text-white/62 md:text-lg">
                {t('description')}
              </p>
            </div>

            {heroPlan ? (
              <SpotlightPanel className="growth-tilt-card rounded-md border border-white/10 bg-white/[0.05] p-5 shadow-[0_30px_110px_rgb(0_0_0/0.36)] backdrop-blur-md transition duration-300">
                <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  <Zap className="size-4 text-[#c9ff82]" />
                  {t('livePlans')}
                </div>
                <div className="rounded-md bg-black/42 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold">{heroPlan.name}</h2>
                    <span className="rounded-md bg-[#c9ff82] px-2 py-1 text-xs font-semibold text-black">
                      {heroPlan.badge}
                    </span>
                  </div>
                  <div className="mt-5 flex items-end gap-2">
                    <span className="text-6xl font-semibold">{heroPlan.price}</span>
                    <span className="pb-2 text-sm text-white/50">{t('perMonth')}</span>
                  </div>
                  <div className="mt-4 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/78">
                    {t('pointsPerMonth', { count: heroPlan.points })}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/55">{t('checkoutNote')}</p>
              </SpotlightPanel>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 md:px-6">
          <SpotlightPanel className="grid gap-3 rounded-md md:grid-cols-3">
          {plans.map((plan, index) => (
            <MagneticLink
              key={plan.name}
              href={plan.href}
              className="growth-tilt-card group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:border-white/24 hover:bg-white/[0.07]"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: index === 1 ? '#c9ff82' : index === 2 ? '#7dd3fc' : '#fca5a5' }} />
              <div className="mb-5 inline-flex rounded-md bg-[#c9ff82] px-2 py-1 text-xs font-semibold text-black">
                {plan.badge}
              </div>
              <h2 className="text-2xl font-semibold">{plan.name}</h2>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-semibold">{plan.price}</span>
                <span className="pb-2 text-sm text-white/50">{t('perMonth')}</span>
              </div>
              <div className="mt-4 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-sm font-semibold text-white/72">
                {t('pointsPerMonth', { count: plan.points })}
              </div>
              <div className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-white/68">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#c9ff82]" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
                {t('choosePlan')}
                <ArrowRight className="size-4" />
              </div>
            </MagneticLink>
          ))}
          </SpotlightPanel>
        </section>

        <section className="border-y border-white/10 bg-[#0b0f0c]">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 md:grid-cols-3 md:px-6">
            {[
              [t('useCases.image.title'), t('useCases.image.body')],
              [t('useCases.video.title'), t('useCases.video.body')],
              [t('useCases.publicGrowth.title'), t('useCases.publicGrowth.body')],
            ].map(([title, body]) => (
              <div key={title} className="growth-chroma-card rounded-md border border-white/10 bg-black/35 p-5">
                <Sparkles className="mb-4 size-5 text-[#c9ff82]" />
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/62">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </PublicGrowthShell>
  );
}
