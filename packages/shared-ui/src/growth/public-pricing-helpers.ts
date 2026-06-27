import { useLocale } from 'next-intl';
import { formatCurrency } from '../format';
import type { MembershipLevel, MembershipPlan, PointsPackage } from '@autix/shared-store';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type CompareValue =
  | { kind: 'text'; text: string }
  | { kind: 'check'; text?: string }
  | { kind: 'dash'; text?: string };

export type PricingPlan = {
  id: string;
  planId: string | null;
  name: string;
  badge: string | null;
  accent: string;
  href: string;
  level: number;
  points: number;
  price: string;
  originalPrice: string | null;
  unit: string;
  features: string[];
  recommended: boolean;
  isFree: boolean;
  yearlyDiscountLabel: string | null;
  comparison: {
    monthlyPoints: CompareValue;
    video: CompareValue;
    watermark: CompareValue;
    commercial: CompareValue;
    queue: CompareValue;
    batch: CompareValue;
    history: CompareValue;
    carryover: CompareValue;
    team: CompareValue;
    invoice: CompareValue;
  };
};

export type PricingCopy = {
  headline: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  billingMonthly: string;
  billingYearly: string;
  yearlyHint: string;
  planSectionTitle: string;
  planSectionBody: string;
  compareTitle: string;
  compareEyebrow: string;
  compareBody: string;
  topUpTitle: string;
  topUpBody: string;
  topUpMembershipOnly: string;
  useCasesTitle: string;
  choosePlan: string;
  popular: string;
  livePlans: string;
  currentCycle: string;
  monthlyCredits: string;
  videoCapability: string;
  topUpOptions: string;
  creditUnit: string;
  included: string;
  notIncluded: string;
  perMonth: string;
  perYear: string;
  noVideo: string;
  limited: string;
  standard: string;
  high: string;
  highest: string;
  enabled: string;
  requestable: string;
  includedInvoice: string;
  validDays: string;
  topUpCta: string;
  pointsPerDollar: string;
  noPerks: string;
  freePlanName: string;
  freeBadge: string;
  freeCta: string;
  currentFreeCta: string;
  selectedPlan: string;
  yearlyDiscountBadge: string;
  yearlyDiscountCaption: string;
  comparisonFeature: string;
  fallbackFeatures: string[];
  freeFeatures: string[];
  starterFeatures: string[];
  creatorFeatures: string[];
  studioFeatures: string[];
  useCases: Array<{ title: string; body: string }>;
};

export const PLAN_ACCENTS = ['#c9ff82', '#7dd3fc', '#fca5a5', '#fbbf24'];

const FALLBACK_TOP_UP_PACKAGES: PointsPackage[] = [
  {
    id: 'fallback-trial-topup',
    code: 'trial_topup',
    name: '体验包',
    description: '临时补足一次轻量创作额度',
    price: '9.90',
    points: 800,
    validityDays: 180,
    sort: 1,
  },
  {
    id: 'fallback-standard-topup',
    code: 'standard_topup',
    name: '标准包',
    description: '适合持续创作中的临时补充额度',
    price: '59.00',
    points: 5500,
    validityDays: 180,
    sort: 2,
  },
  {
    id: 'fallback-pro-topup',
    code: 'pro_topup',
    name: '专业包',
    description: '高频个人补差，需已有有效订阅会员',
    price: '199.00',
    points: 20000,
    validityDays: 180,
    sort: 3,
  },
  {
    id: 'fallback-team-topup',
    code: 'team_topup',
    name: '团队补差包',
    description: '小团队临时补差，商用授权仍以会员权益为准',
    price: '599.00',
    points: 60000,
    validityDays: 365,
    showCommercialLicense: true,
    sort: 4,
  },
];

export const zhPricingCopy: PricingCopy = {
  headline: '会员权益与创作加油包，一次看清。',
  description:
    '订阅会员获得每月积分、视频生成、去水印、队列优先和商用授权；临时项目需要更多额度时，再用加油包补足。',
  primaryCta: '升级会员',
  secondaryCta: '查看加油包',
  billingMonthly: '月付',
  billingYearly: '年付',
  yearlyHint: '权益立即生效，积分按月发放',
  planSectionTitle: '选择最适合当前创作节奏的会员',
  planSectionBody: '每一档都包含月度积分池；更高等级会解锁更强视频、商用和协作权益。',
  compareTitle: '会员权益对比',
  compareEyebrow: '权益矩阵',
  compareBody: '从积分、视频时长、商用授权到历史保存，关键权益放在同一张表里。',
  topUpTitle: '创作加油包',
  topUpBody: '加油包用于临时补差，不替代会员权益。适合活动冲刺、批量出图或视频项目超额时补充积分。',
  topUpMembershipOnly: '仅有效订阅会员可购买',
  useCasesTitle: '积分可以投入到这些工作流',
  choosePlan: '选择套餐',
  popular: '推荐',
  livePlans: '服务端实时套餐',
  currentCycle: '当前周期',
  monthlyCredits: '月度积分池',
  videoCapability: '视频能力',
  topUpOptions: '加油包选项',
  creditUnit: '积分',
  included: '包含',
  notIncluded: '未包含',
  perMonth: '/ 月',
  perYear: '/ 年',
  noVideo: '未开放',
  limited: '轻量',
  standard: '标准',
  high: '高优先',
  highest: '最高优先',
  enabled: '已开放',
  requestable: '可申请',
  includedInvoice: '已包含',
  validDays: '有效期 {days} 天',
  topUpCta: '购买加油包',
  pointsPerDollar: '约 {ratio} 积分/美元',
  noPerks: '不含会员权益',
  freePlanName: 'Free',
  freeBadge: '免费',
  freeCta: '免费开始',
  currentFreeCta: '当前可用',
  selectedPlan: '已选套餐',
  yearlyDiscountBadge: '20% OFF',
  yearlyDiscountCaption: '年付优惠',
  comparisonFeature: '权益项目',
  fallbackFeatures: ['月度创作积分', '私密创作空间', '作品发布页'],
  freeFeatures: ['公开浏览和收藏灵感', '私有草稿与基础发布', '适合低频试用'],
  starterFeatures: ['公开浏览和收藏灵感', '私有草稿与基础发布', '适合低频试用'],
  creatorFeatures: ['图片和视频积分池', '去水印与公开作品页', '个人创作者主页'],
  studioFeatures: ['更高生成额度', '批量创作与队列优先', '团队和商用工作流'],
  useCases: [
    { title: '图片生成', body: '提示词、参考图、编辑和批量变体都会消耗积分。' },
    { title: '视频项目', body: '分镜、Seedance 生成、视频素材组合适合使用更高会员权益。' },
    { title: '公开增长', body: '作品页、创作者主页、预设和社区集合帮助作品从私密草稿走向发布。' },
  ],
};

export const enPricingCopy: PricingCopy = {
  headline: 'Membership benefits and top-up packs, all in one view.',
  description:
    'Membership gives you monthly credits, video generation, watermark removal, priority queues, and commercial rights. Add top-up packs when a project needs extra capacity.',
  primaryCta: 'Upgrade membership',
  secondaryCta: 'View top-ups',
  billingMonthly: 'Monthly',
  billingYearly: 'Yearly',
  yearlyHint: 'Benefits start now; credits are delivered monthly',
  planSectionTitle: 'Pick the membership that matches your creative pace',
  planSectionBody: 'Every tier includes a monthly credit pool. Higher tiers unlock stronger video, commercial, and collaboration benefits.',
  compareTitle: 'Membership comparison',
  compareEyebrow: 'Benefit matrix',
  compareBody: 'Credits, video duration, commercial rights, and retention are placed in one decision table.',
  topUpTitle: 'Creative top-up packs',
  topUpBody: 'Top-ups cover short-term credit gaps and do not replace membership benefits. Use them for campaign bursts, batch images, or video overages.',
  topUpMembershipOnly: 'Available to active members only',
  useCasesTitle: 'Where your credits go',
  choosePlan: 'Choose plan',
  popular: 'Recommended',
  livePlans: 'Live server plans',
  currentCycle: 'Current cycle',
  monthlyCredits: 'Monthly credits',
  videoCapability: 'Video capability',
  topUpOptions: 'Top-up options',
  creditUnit: 'credits',
  included: 'Included',
  notIncluded: 'Not included',
  perMonth: '/ month',
  perYear: '/ year',
  noVideo: 'Not enabled',
  limited: 'Limited',
  standard: 'Standard',
  high: 'High priority',
  highest: 'Highest priority',
  enabled: 'Enabled',
  requestable: 'Requestable',
  includedInvoice: 'Included',
  validDays: 'Valid for {days} days',
  topUpCta: 'Buy top-up',
  pointsPerDollar: '~{ratio} credits/$',
  noPerks: 'No membership perks',
  freePlanName: 'Free',
  freeBadge: 'Free',
  freeCta: 'Start free',
  currentFreeCta: 'Available now',
  selectedPlan: 'Selected plan',
  yearlyDiscountBadge: '20% OFF',
  yearlyDiscountCaption: 'Yearly discount',
  comparisonFeature: 'Benefit',
  fallbackFeatures: ['Monthly creative credits', 'Private workspace', 'Publishable creation pages'],
  freeFeatures: ['Browse and collect inspiration', 'Private drafts and basic publishing', 'Best for light testing'],
  starterFeatures: ['Browse and collect inspiration', 'Private drafts and basic publishing', 'Best for light testing'],
  creatorFeatures: ['Image and video credit pool', 'Watermark removal and public pages', 'Creator profile'],
  studioFeatures: ['Higher generation capacity', 'Batch creation and priority queues', 'Team and commercial workflows'],
  useCases: [
    { title: 'Image generation', body: 'Prompts, reference images, edits, and batch variants spend credits.' },
    { title: 'Video projects', body: 'Storyboards, Seedance generations, and media assembly benefit from stronger tiers.' },
    { title: 'Public growth', body: 'Creation pages, profiles, presets, and communities move approved work from draft to launch.' },
  ],
};

export function usePricingCopy() {
  const locale = useLocale();
  return locale.startsWith('zh') ? zhPricingCopy : enPricingCopy;
}

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

function mapQueuePriority(value: unknown, copy: PricingCopy) {
  const text = readText(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === 'high') return copy.high;
  if (normalized === 'highest') return copy.highest;
  if (normalized === 'standard') return copy.standard;
  return text;
}

function mapBatchGeneration(value: unknown, copy: PricingCopy) {
  const text = readText(value);
  if (!text && value !== true) return null;
  if (value === true) return copy.enabled;
  const normalized = text?.toLowerCase();
  if (normalized === 'limited') return copy.limited;
  if (normalized === 'enabled') return copy.enabled;
  return text ?? copy.enabled;
}

function mapInvoice(value: unknown, copy: PricingCopy) {
  const text = readText(value);
  if (!text && value !== true) return null;
  if (value === true) return copy.includedInvoice;
  const normalized = text?.toLowerCase();
  if (normalized === 'requestable') return copy.requestable;
  if (normalized === 'included') return copy.includedInvoice;
  return text ?? copy.includedInvoice;
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

function getFeatureBullets(level: MembershipLevel, copy: PricingCopy) {
  if (isFreeLevel(level)) return copy.freeFeatures;

  if (Array.isArray(level.features)) {
    const labels = level.features
      .filter((feature): feature is string => typeof feature === 'string' && feature.trim().length > 0)
      .slice(0, 5);
    return labels.length ? labels : copy.fallbackFeatures;
  }

  const features = getRecord(level.features);
  if (!features) return copy.fallbackFeatures;

  const bullets: string[] = [];
  const videoText = getVideoText(level.features);
  const queue = mapQueuePriority(features.queuePriority, copy);
  const batch = mapBatchGeneration(features.batchGeneration, copy);
  const historyDays = readNumber(features.historyRetentionDays);
  const isEnglish = copy === enPricingCopy;

  if (readNumber(features.basePointsPerMonth) || readNumber(features.bonusPointsPerMonth)) {
    bullets.push(`${formatCount(level.pointsPerMonth)} ${copy.creditUnit} / month`);
  }
  if (features.removeWatermark) bullets.push(isEnglish ? 'Watermark-free exports' : '生成作品去水印');
  if (features.commercialLicense) bullets.push(isEnglish ? 'Commercial usage rights' : '商用授权覆盖');
  if (videoText) bullets.push(`Seedance ${videoText}`);
  if (queue) bullets.push(`${isEnglish ? 'Queue' : '队列'} ${queue}`);
  if (batch) bullets.push(`${isEnglish ? 'Batch generation' : '批量生成'} ${batch}`);
  if (historyDays) bullets.push(isEnglish ? `${historyDays} days history` : `历史保存 ${historyDays} 天`);

  return bullets.length ? bullets.slice(0, 5) : copy.fallbackFeatures;
}

function makeTextValue(text: string | null | undefined): CompareValue {
  return text ? { kind: 'text', text } : { kind: 'dash' };
}

function makeCheckValue(enabled: boolean | undefined, copy: PricingCopy): CompareValue {
  return enabled ? { kind: 'check', text: copy.included } : { kind: 'dash', text: copy.notIncluded };
}

function buildComparison(level: MembershipLevel, points: number, copy: PricingCopy): PricingPlan['comparison'] {
  const features = getRecord(level.features);
  const isEnglish = copy === enPricingCopy;
  const videoText = getVideoText(level.features);
  const queue = mapQueuePriority(features?.queuePriority, copy);
  const batch = mapBatchGeneration(features?.batchGeneration, copy);
  const invoice = mapInvoice(features?.invoice, copy);
  const historyDays = readNumber(features?.historyRetentionDays);
  const carryover = getRecord(features?.pointsCarryover);
  const carryoverText = carryover?.enabled
    ? `${readNumber(carryover.maxCycles) ?? 1} ${isEnglish ? 'cycle' : '周期'} · ${formatCount(readNumber(carryover.maxPoints) ?? points)}`
    : null;

  return {
    monthlyPoints: { kind: 'text', text: `${formatCount(points)} ${copy.creditUnit}` },
    video: makeTextValue(videoText ?? copy.noVideo),
    watermark: makeCheckValue(Boolean(features?.removeWatermark), copy),
    commercial: makeCheckValue(Boolean(features?.commercialLicense), copy),
    queue: makeTextValue(queue ?? copy.standard),
    batch: makeTextValue(batch ?? copy.notIncluded),
    history: makeTextValue(historyDays ? `${historyDays} ${isEnglish ? 'days' : '天'}` : null),
    carryover: makeTextValue(carryoverText),
    team: makeCheckValue(Boolean(features?.teamSpace), copy),
    invoice: makeTextValue(invoice),
  };
}

function buildFreePlan(copy: PricingCopy): PricingPlan {
  return {
    id: 'free',
    planId: null,
    name: copy.freePlanName,
    badge: copy.freeBadge,
    accent: '#a8b3c7',
    href: '/register',
    level: 0,
    points: 0,
    price: '$0',
    originalPrice: null,
    unit: copy.perMonth,
    features: copy.freeFeatures,
    recommended: false,
    isFree: true,
    yearlyDiscountLabel: null,
    comparison: {
      monthlyPoints: { kind: 'text', text: `0 ${copy.creditUnit}` },
      video: { kind: 'dash', text: copy.noVideo },
      watermark: makeCheckValue(false, copy),
      commercial: makeCheckValue(false, copy),
      queue: { kind: 'text', text: copy.standard },
      batch: { kind: 'dash', text: copy.notIncluded },
      history: { kind: 'dash', text: copy.notIncluded },
      carryover: { kind: 'dash', text: copy.notIncluded },
      team: makeCheckValue(false, copy),
      invoice: { kind: 'dash', text: copy.notIncluded },
    },
  };
}

function buildFallbackPlans(copy: PricingCopy, cycle: BillingCycle): PricingPlan[] {
  const names = [copy.freePlanName, 'Creator', 'Studio'];
  const featureSets = [copy.freeFeatures, copy.creatorFeatures, copy.studioFeatures];
  const points = [0, 12000, 52000];
  const prices = ['$0', '$19', '$79'];

  return names.map((name, index) => ({
    id: `fallback-${name}`,
    planId: index === 0 ? null : `fallback-plan-${name}`,
    name,
    badge: index === 0 ? copy.freeBadge : index === 1 ? copy.popular : null,
    accent: index === 0 ? '#a8b3c7' : PLAN_ACCENTS[index - 1]!,
    href: index === 0 ? '/register' : '/membership/upgrade',
    level: index,
    points: points[index]!,
    price: prices[index]!,
    originalPrice: null,
    unit: index === 0 ? copy.perMonth : cycle === 'MONTHLY' ? copy.perMonth : copy.perYear,
    features: featureSets[index]!,
    recommended: index === 1,
    isFree: index === 0,
    yearlyDiscountLabel: cycle === 'YEARLY' && index > 0 ? copy.yearlyDiscountBadge : null,
    comparison: {
      monthlyPoints: { kind: 'text', text: `${formatCount(points[index]!)} ${copy.creditUnit}` },
      video: index === 0 ? { kind: 'dash', text: copy.noVideo } : { kind: 'text', text: index === 1 ? '720p · 5s · 1x' : '1080p · 30s · 4x' },
      watermark: makeCheckValue(index > 0, copy),
      commercial: makeCheckValue(index > 1, copy),
      queue: { kind: 'text', text: index === 2 ? copy.highest : copy.standard },
      batch: { kind: 'text', text: index === 2 ? copy.enabled : copy.limited },
      history: { kind: 'text', text: index === 2 ? `365 ${copy === enPricingCopy ? 'days' : '天'}` : `30 ${copy === enPricingCopy ? 'days' : '天'}` },
      carryover: index === 0 ? { kind: 'dash' } : { kind: 'text', text: `1 ${copy === enPricingCopy ? 'cycle' : '周期'}` },
      team: makeCheckValue(index === 2, copy),
      invoice: index === 2 ? { kind: 'text', text: copy.includedInvoice } : { kind: 'dash' },
    },
  }));
}

export function buildPricingPlans(
  levels: MembershipLevel[] | null | undefined,
  cycle: BillingCycle,
  copy: PricingCopy,
): PricingPlan[] {
  const activeLevels = (levels ?? [])
    .filter((level) => level.isActive !== false)
    .sort((a, b) => (a.sort ?? a.level) - (b.sort ?? b.level));

  if (!activeLevels.length) return buildFallbackPlans(copy, cycle);

  const paidLevels = activeLevels.filter((level) => !isFreeLevel(level));

  const recommendedId =
    paidLevels.find((level) => getRecord(level.features)?.recommended)?.id
    ?? paidLevels[Math.min(1, paidLevels.length - 1)]?.id
    ?? activeLevels[0]?.id;

  let paidAccentIndex = 0;

  const plans = activeLevels.map((level) => {
    const plan = pickPlan(level, cycle);
    const points = plan?.points ?? level.pointsPerMonth;
    const recommended = level.id === recommendedId;
    const isFree = isFreeLevel(level);
    const accent = isFree ? '#a8b3c7' : PLAN_ACCENTS[paidAccentIndex++ % PLAN_ACCENTS.length]!;
    const badge = recommended
      ? copy.popular
      : isFree
        ? copy.freeBadge
        : plan?.discountLabel ?? plan?.firstTimeLabel ?? null;
    const originalPrice =
      plan && plan.originalPrice !== plan.price ? formatCurrency(plan.originalPrice) : null;

    return {
      id: level.id,
      planId: isFree ? null : plan?.id ?? null,
      name: level.name,
      badge,
      accent,
      href: level.level <= 0 ? '/register' : '/membership/upgrade',
      level: level.level,
      points,
      price: formatPlanPrice(plan, level.monthlyPrice),
      originalPrice,
      unit: isFree ? copy.perMonth : cycle === 'MONTHLY' ? copy.perMonth : copy.perYear,
      features: getFeatureBullets(level, copy),
      recommended,
      isFree,
      yearlyDiscountLabel: cycle === 'YEARLY' && !isFree ? copy.yearlyDiscountBadge : null,
      comparison: buildComparison(level, points, copy),
    };
  });

  return plans.some((plan) => plan.isFree) ? plans : [buildFreePlan(copy), ...plans];
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
