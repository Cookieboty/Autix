import { formatCurrency } from '../format';
import type { MembershipLevel, MembershipPlan, PointsPackage } from '@autix/shared-store';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

/** 统一色调：neutral=中性白 / brand=品牌绿(推荐) / top=品红(最高档)。全站定价模块共用 */
export type PlanTone = 'neutral' | 'brand' | 'top';

export const TONE_ACCENT: Record<PlanTone, string> = {
  neutral: 'var(--color-foreground)',
  brand: 'var(--growth-accent)',
  top: 'var(--growth-plan-top)',
};

export type QueuePriority = 'standard' | 'high' | 'highest';
export type BatchLevel = 'disabled' | 'limited' | 'enabled';
export type InvoiceStatus = 'included' | 'requestable';

export type FeatureItem =
  | { kind: 'points'; count: number }
  | { kind: 'watermark' }
  | { kind: 'commercial' }
  | { kind: 'video'; spec: string }
  | { kind: 'queue'; priority: QueuePriority }
  | { kind: 'batch'; level: Exclude<BatchLevel, 'disabled'> }
  | { kind: 'history'; days: number }
  | { kind: 'server'; text: string };

export type PlanComparison = {
  monthlyPoints: number;
  videoSpec: string | null;
  imageConcurrency: number | null;
  videoConcurrency: number | null;
  removeWatermark: boolean;
  commercialLicense: boolean;
  queuePriority: QueuePriority;
  batchGeneration: BatchLevel;
  historyDays: number | null;
  carryoverCycles: number | null;
  carryoverMaxPoints: number | null;
  teamSpace: boolean;
  invoiceStatus: InvoiceStatus | null;
};

export type PricingPlan = {
  id: string;
  planId: string | null;
  serverName: string;
  badgeKey: 'popular' | 'free' | string | null;
  hasYearlyDiscount: boolean;
  tone: PlanTone;
  accent: string;
  href: string;
  level: number;
  points: number;
  price: string;
  /** 按月展示价：月付=月价；年付=年费/12（用于「per month, billed annually」样式） */
  pricePerMonth: string;
  originalPrice: string | null;
  /** 年付相对逐月付费的节省金额（无优惠时为 null） */
  annualSavings: string | null;
  billingCycle: BillingCycle;
  recommended: boolean;
  isFree: boolean;
  featureItems: FeatureItem[];
  comparison: PlanComparison;
};

export const PLAN_ACCENTS: string[] = [
  'var(--growth-plan-0)',
  'var(--growth-plan-1)',
  'var(--growth-plan-2)',
  'var(--growth-plan-3)',
];
export const FREE_PLAN_ACCENT = 'var(--growth-plan-free)';

const FALLBACK_TOP_UP_PACKAGES: PointsPackage[] = [
  {
    id: 'fallback-trial-topup',
    code: 'trial_topup',
    name: 'trial_topup',
    price: '9.90',
    points: 800,
    validityDays: 180,
    sort: 1,
  },
  {
    id: 'fallback-standard-topup',
    code: 'standard_topup',
    name: 'standard_topup',
    price: '59.00',
    points: 5500,
    validityDays: 180,
    sort: 2,
  },
  {
    id: 'fallback-pro-topup',
    code: 'pro_topup',
    name: 'pro_topup',
    price: '199.00',
    points: 20000,
    validityDays: 180,
    sort: 3,
  },
  {
    id: 'fallback-team-topup',
    code: 'team_topup',
    name: 'team_topup',
    price: '599.00',
    points: 60000,
    validityDays: 365,
    showCommercialLicense: true,
    sort: 4,
  },
];

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPlanPrice(plan: MembershipPlan | null, fallback?: string | number | null) {
  const displayPrice = plan?.firstTimePrice ?? plan?.price ?? fallback ?? 0;
  return formatCurrency(displayPrice);
}

function pickPlan(level: MembershipLevel, cycle: BillingCycle): MembershipPlan | null {
  return level.plans.find((plan) => plan.billingCycle === cycle && plan.autoRenew)
    ?? level.plans.find((plan) => plan.billingCycle === cycle)
    ?? level.plans.find((plan) => plan.billingCycle === 'MONTHLY' && plan.autoRenew)
    ?? level.plans[0]
    ?? null;
}

function isFreeLevel(level: MembershipLevel) {
  return level.level <= 0 || Number(level.monthlyPrice) <= 0;
}

function readSeedance(features: MembershipLevel['features']) {
  const record = getRecord(features);
  return getRecord(record?.seedance);
}

function getVideoText(features: MembershipLevel['features']) {
  const seedance = readSeedance(features);
  if (!seedance?.enabled) return null;
  const resolution = readText(seedance.maxResolution) ?? '720p';
  const duration = readNumber(seedance.maxDurationSeconds) ?? 5;
  const concurrency = readNumber(seedance.concurrency) ?? 1;
  return `${resolution} · ${duration}s · ${concurrency}x`;
}

function mapQueuePriority(value: unknown): QueuePriority {
  const text = readText(value);
  if (!text) return 'standard';
  const normalized = text.toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'highest') return 'highest';
  return 'standard';
}

function mapBatchGeneration(value: unknown): BatchLevel {
  const text = readText(value);
  if (!text && value !== true) return 'disabled';
  if (value === true) return 'enabled';
  const normalized = text?.toLowerCase();
  if (normalized === 'limited') return 'limited';
  if (normalized === 'enabled') return 'enabled';
  return 'enabled';
}

function mapInvoice(value: unknown): InvoiceStatus | null {
  const text = readText(value);
  if (!text && value !== true) return null;
  if (value === true) return 'included';
  const normalized = text?.toLowerCase();
  if (normalized === 'requestable') return 'requestable';
  if (normalized === 'included') return 'included';
  return 'included';
}

function getFeatureItems(level: MembershipLevel): FeatureItem[] {
  if (isFreeLevel(level)) {
    return [
      { kind: 'server', text: 'free-feature-0' },
      { kind: 'server', text: 'free-feature-1' },
      { kind: 'server', text: 'free-feature-2' },
    ];
  }

  if (Array.isArray(level.features)) {
    const labels = level.features
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .slice(0, 5);
    if (labels.length) return labels.map((text) => ({ kind: 'server', text }));
    return [{ kind: 'server', text: 'fallback' }];
  }

  const features = getRecord(level.features);
  if (!features) return [{ kind: 'server', text: 'fallback' }];

  const items: FeatureItem[] = [];
  const videoSpec = getVideoText(level.features);
  const queue = mapQueuePriority(features.queuePriority);
  const batch = mapBatchGeneration(features.batchGeneration);
  const historyDays = readNumber(features.historyRetentionDays);

  if (readNumber(features.basePointsPerMonth) || readNumber(features.bonusPointsPerMonth)) {
    items.push({ kind: 'points', count: level.pointsPerMonth });
  }
  if (features.removeWatermark) items.push({ kind: 'watermark' });
  if (features.commercialLicense) items.push({ kind: 'commercial' });
  if (videoSpec) items.push({ kind: 'video', spec: videoSpec });
  if (queue !== 'standard') items.push({ kind: 'queue', priority: queue });
  if (batch !== 'disabled') items.push({ kind: 'batch', level: batch as 'limited' | 'enabled' });
  if (historyDays) items.push({ kind: 'history', days: historyDays });

  return items.length ? items.slice(0, 5) : [{ kind: 'server', text: 'fallback' }];
}

function buildComparison(level: MembershipLevel, points: number): PlanComparison {
  const features = getRecord(level.features);
  const videoSpec = getVideoText(level.features);
  const queuePriority = mapQueuePriority(features?.queuePriority);
  const batchGeneration = mapBatchGeneration(features?.batchGeneration);
  const invoice = mapInvoice(features?.invoice);
  const historyDays = readNumber(features?.historyRetentionDays);
  const carryover = getRecord(features?.pointsCarryover);
  const seedance = readSeedance(level.features);

  return {
    monthlyPoints: points,
    videoSpec: videoSpec,
    imageConcurrency: readNumber(getRecord(features?.image)?.concurrency),
    videoConcurrency: seedance?.enabled ? readNumber(seedance.concurrency) : null,
    removeWatermark: Boolean(features?.removeWatermark),
    commercialLicense: Boolean(features?.commercialLicense),
    queuePriority,
    batchGeneration,
    historyDays,
    carryoverCycles: carryover?.enabled ? (readNumber(carryover.maxCycles) ?? 1) : null,
    carryoverMaxPoints: carryover?.enabled ? (readNumber(carryover.maxPoints) ?? points) : null,
    teamSpace: Boolean(features?.teamSpace),
    invoiceStatus: invoice,
  };
}

function buildFreePlan(): PricingPlan {
  return {
    id: 'free',
    planId: null,
    serverName: 'Free',
    badgeKey: 'free',
    tone: 'neutral',
    accent: TONE_ACCENT.neutral,
    href: '/register',
    level: 0,
    points: 0,
    price: '$0',
    pricePerMonth: '$0',
    originalPrice: null,
    annualSavings: null,
    billingCycle: 'MONTHLY',
    recommended: false,
    isFree: true,
    hasYearlyDiscount: false,
    featureItems: [
      { kind: 'server', text: 'free-feature-0' },
      { kind: 'server', text: 'free-feature-1' },
      { kind: 'server', text: 'free-feature-2' },
    ],
    comparison: {
      monthlyPoints: 0,
      videoSpec: null,
      imageConcurrency: null,
      videoConcurrency: null,
      removeWatermark: false,
      commercialLicense: false,
      queuePriority: 'standard',
      batchGeneration: 'disabled',
      historyDays: null,
      carryoverCycles: null,
      carryoverMaxPoints: null,
      teamSpace: false,
      invoiceStatus: null,
    },
  };
}

function buildFallbackPlans(cycle: BillingCycle): PricingPlan[] {
  const serverNames = ['Free', 'Creator', 'Studio'];
  const points = [0, 12000, 52000];
  const prices = ['$0', '$19', '$79'];

  const fallbackTones: PlanTone[] = ['neutral', 'brand', 'top'];
  return serverNames.map((serverName, index) => ({
    id: `fallback-${serverName.toLowerCase()}`,
    planId: index === 0 ? null : `fallback-plan-${serverName.toLowerCase()}`,
    serverName,
    badgeKey: index === 0 ? 'free' : index === 1 ? 'popular' : null,
    tone: fallbackTones[index]!,
    accent: TONE_ACCENT[fallbackTones[index]!],
    href: index === 0 ? '/register' : '/membership/upgrade',
    level: index,
    points: points[index]!,
    price: prices[index]!,
    pricePerMonth: prices[index]!,
    originalPrice: null,
    annualSavings: null,
    billingCycle: cycle,
    recommended: index === 1,
    isFree: index === 0,
    hasYearlyDiscount: cycle === 'YEARLY' && index > 0,
    featureItems: index === 0
      ? [{ kind: 'server' as const, text: 'free-feature-0' }, { kind: 'server' as const, text: 'free-feature-1' }, { kind: 'server' as const, text: 'free-feature-2' }]
      : index === 1
        ? [{ kind: 'watermark' as const }, { kind: 'commercial' as const }, { kind: 'video' as const, spec: '720p · 5s · 1x' }, { kind: 'server' as const, text: 'creator-profile' }]
        : [{ kind: 'video' as const, spec: '1080p · 30s · 4x' }, { kind: 'batch' as const, level: 'enabled' as const }, { kind: 'history' as const, days: 365 }, { kind: 'server' as const, text: 'team-workspace' }],
    comparison: {
      monthlyPoints: points[index]!,
      videoSpec: index === 0 ? null : index === 1 ? '720p · 5s · 1x' : '1080p · 30s · 4x',
      imageConcurrency: index === 0 ? null : index === 1 ? 4 : 8,
      videoConcurrency: index === 0 ? null : index === 1 ? 1 : 4,
      removeWatermark: index > 0,
      commercialLicense: index > 1,
      queuePriority: (index === 2 ? 'highest' : 'standard') as QueuePriority,
      batchGeneration: (index === 0 ? 'disabled' : index === 1 ? 'limited' : 'enabled') as BatchLevel,
      historyDays: index === 0 ? null : index === 1 ? 30 : 365,
      carryoverCycles: index === 0 ? null : 1,
      carryoverMaxPoints: index === 0 ? null : points[index]!,
      teamSpace: index === 2,
      invoiceStatus: index === 2 ? 'included' as InvoiceStatus : null,
    },
  })) as PricingPlan[];
}

export function buildPricingPlans(
  levels: MembershipLevel[] | null | undefined,
  cycle: BillingCycle,
): PricingPlan[] {
  const activeLevels = (levels ?? [])
    .filter((level) => level.isActive !== false)
    .sort((a, b) => (a.sort ?? a.level) - (b.sort ?? b.level));

  if (!activeLevels.length) return buildFallbackPlans(cycle);

  const paidLevels = activeLevels.filter((level) => !isFreeLevel(level));

  const recommendedId =
    paidLevels.find((level) => getRecord(level.features)?.recommended)?.id
    ?? paidLevels[Math.min(1, paidLevels.length - 1)]?.id
    ?? activeLevels[0]?.id;

  // 色调统一：推荐档=brand(绿)，最高价付费档=top(品红)，其余=neutral(白)
  const maxPaidLevel = Math.max(
    0,
    ...activeLevels.filter((level) => !isFreeLevel(level)).map((level) => level.level),
  );

  const plans = activeLevels.map((level) => {
    const plan = pickPlan(level, cycle);
    const points = plan?.points ?? level.pointsPerMonth;
    const recommended = level.id === recommendedId;
    const isFree = isFreeLevel(level);
    const tone: PlanTone = recommended
      ? 'brand'
      : !isFree && level.level === maxPaidLevel
        ? 'top'
        : 'neutral';
    const accent = TONE_ACCENT[tone];
    const badgeKey = recommended
      ? 'popular'
      : isFree
        ? 'free'
        : plan?.discountLabel ?? plan?.firstTimeLabel ?? null;
    const originalPrice =
      plan && plan.originalPrice !== plan.price ? formatCurrency(plan.originalPrice) : null;

    // 按月展示价：年付时用 年费 / 月数（无优惠则与月付价一致）
    const months = plan?.months && plan.months > 0 ? plan.months : cycle === 'YEARLY' ? 12 : 1;
    const rawTotal = Number(plan?.firstTimePrice ?? plan?.price ?? level.monthlyPrice ?? 0);
    const pricePerMonth = formatCurrency(
      Number.isFinite(rawTotal) && months > 1 ? rawTotal / months : rawTotal,
    );

    // 年付相对逐月付费的节省（仅当确有优惠时展示）
    let annualSavings: string | null = null;
    if (cycle === 'YEARLY' && !isFree) {
      const monthlyPlan = level.plans.find((p) => p.billingCycle === 'MONTHLY');
      const monthlyOverYear = Number(monthlyPlan?.price) * 12;
      const yearlyTotal = Number(plan?.price);
      if (
        monthlyPlan &&
        Number.isFinite(monthlyOverYear) &&
        Number.isFinite(yearlyTotal) &&
        monthlyOverYear - yearlyTotal > 0.01
      ) {
        annualSavings = formatCurrency(monthlyOverYear - yearlyTotal);
      }
    }

    return {
      id: level.id,
      planId: isFree ? null : plan?.id ?? null,
      serverName: level.name,
      badgeKey,
      tone,
      accent,
      href: level.level <= 0 ? '/register' : '/membership/upgrade',
      level: level.level,
      points,
      price: formatPlanPrice(plan, level.monthlyPrice),
      pricePerMonth,
      originalPrice,
      annualSavings,
      billingCycle: cycle,
      recommended,
      isFree,
      hasYearlyDiscount: cycle === 'YEARLY' && !isFree,
      featureItems: getFeatureItems(level),
      comparison: buildComparison(level, points),
    } satisfies PricingPlan;
  });

  return plans.some((plan) => plan.isFree) ? plans : [buildFreePlan(), ...plans];
}

export function normalizePointsPackages(packages: PointsPackage[] | null | undefined) {
  const source = packages?.length ? packages : FALLBACK_TOP_UP_PACKAGES;
  return [...source]
    .filter((pkg) => pkg.isActive !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function pointsPerDollar(pkg: PointsPackage) {
  const price = Number(pkg.price);
  if (!Number.isFinite(price) || price <= 0) return '-';
  return (pkg.points / price).toFixed(1);
}
