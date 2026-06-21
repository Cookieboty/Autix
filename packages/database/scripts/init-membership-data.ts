#!/usr/bin/env bun
/**
 * Initialize baseline membership data.
 *
 * Default behavior is conservative: create missing levels, plans, and point
 * packages, but do not overwrite existing admin-managed configuration.
 *
 * Set INIT_MEMBERSHIP_OVERWRITE=true to update existing seed-owned rows.
 */

import {
  BillingCycle,
  getDatabaseUrl,
  PrismaClient,
} from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';

type MembershipLevelSeed = {
  name: string;
  level: number;
  monthlyPrice: number;
  pointsPerMonth: number;
  features: Record<string, unknown>;
  isActive?: boolean;
  sort?: number;
};

type MembershipPlanSeed = {
  billingCycle: BillingCycle;
  months: number;
  autoRenew: boolean;
  originalPrice: number;
  price: number;
  firstTimePrice: number | null;
  points: number;
  discountLabel?: string | null;
  firstTimeLabel?: string | null;
  sort: number;
};

type PointsPackageSeed = {
  code: string;
  name: string;
  description: string;
  price: number;
  points: number;
  validityDays: number;
  usageScope: Record<string, unknown>;
  showCommercialLicense?: boolean;
  sort: number;
};

const overwrite = process.env.INIT_MEMBERSHIP_OVERWRITE === 'true';
const rmbPerUsd = 7;

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
});
const prisma = new PrismaClient({ adapter });

function usdFromRmb(amount: number): number {
  return Number((amount / rmbPerUsd).toFixed(2));
}

const levels: MembershipLevelSeed[] = [
  {
    name: 'Free',
    level: 0,
    monthlyPrice: 0,
    pointsPerMonth: 0,
    features: {
      oneTimePoints: 100,
      removeWatermark: false,
      commercialLicense: false,
      seedance: { enabled: false, maxDurationSeconds: 0, concurrency: 1 },
      historyRetentionDays: 7,
    },
    sort: 0,
  },
  {
    name: 'Starter',
    level: 1,
    monthlyPrice: usdFromRmb(29),
    pointsPerMonth: 2500,
    features: {
      removeWatermark: true,
      commercialLicense: false,
      seedance: { enabled: true, maxResolution: '720p', maxDurationSeconds: 5, concurrency: 1 },
      historyRetentionDays: 30,
    },
    sort: 1,
  },
  {
    name: 'Creator',
    level: 2,
    monthlyPrice: usdFromRmb(69),
    pointsPerMonth: 6500,
    features: {
      recommended: true,
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 10, concurrency: 2 },
      queuePriority: 'normal',
      batchGeneration: 'limited',
      historyRetentionDays: 90,
    },
    sort: 2,
  },
  {
    name: 'Pro',
    level: 3,
    monthlyPrice: usdFromRmb(199),
    pointsPerMonth: 20000,
    features: {
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 15, concurrency: 4 },
      queuePriority: 'high',
      batchGeneration: 'enabled',
      historyRetentionDays: 180,
      invoice: 'requestable',
      pointsCarryover: { enabled: true, maxCycles: 1, maxPoints: 20000 },
    },
    sort: 3,
  },
  {
    name: 'Studio',
    level: 4,
    monthlyPrice: usdFromRmb(599),
    pointsPerMonth: 65000,
    features: {
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 30, concurrency: 8 },
      queuePriority: 'highest',
      batchGeneration: 'enabled',
      historyRetentionDays: 365,
      teamSpace: true,
      invoice: 'included',
      pointsCarryover: { enabled: true, maxCycles: 1, maxPoints: 65000 },
    },
    sort: 4,
  },
  {
    name: 'Business',
    level: 5,
    monthlyPrice: usdFromRmb(1999),
    pointsPerMonth: 0,
    isActive: false,
    features: {
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 60, concurrency: 16 },
      queuePriority: 'enterprise',
      batchGeneration: 'custom',
      historyRetentionDays: 365,
      teamSpace: true,
      invoice: 'contract',
      contractConfig: true,
    },
    sort: 5,
  },
];

function plans(monthlyPriceRmb: number, monthlyPoints: number, sortStart: number): MembershipPlanSeed[] {
  const yearlyOriginalRmb = monthlyPriceRmb * 12;
  const yearlyDiscountRmb = Math.round(yearlyOriginalRmb * 0.85);
  return [
    {
      billingCycle: BillingCycle.MONTHLY,
      months: 1,
      autoRenew: false,
      originalPrice: usdFromRmb(monthlyPriceRmb),
      price: usdFromRmb(monthlyPriceRmb),
      firstTimePrice: usdFromRmb(monthlyPriceRmb),
      points: monthlyPoints,
      sort: sortStart,
    },
    {
      billingCycle: BillingCycle.YEARLY,
      months: 12,
      autoRenew: false,
      originalPrice: usdFromRmb(yearlyOriginalRmb),
      price: usdFromRmb(yearlyDiscountRmb),
      firstTimePrice: usdFromRmb(yearlyDiscountRmb),
      discountLabel: '年付 8.5 折，积分按月发放',
      points: monthlyPoints,
      sort: sortStart + 1,
    },
  ];
}

const plansByLevel: Record<number, MembershipPlanSeed[]> = {
  0: [
    {
      billingCycle: BillingCycle.MONTHLY,
      months: 1,
      autoRenew: false,
      originalPrice: 0,
      price: 0,
      firstTimePrice: 0,
      points: 100,
      sort: 0,
    },
  ],
  1: plans(29, 2500, 10),
  2: plans(69, 6500, 20),
  3: plans(199, 20000, 30),
  4: plans(599, 65000, 40),
  5: [],
};

const pointPackages: PointsPackageSeed[] = [
  {
    code: 'trial_topup',
    name: '体验包',
    description: '临时补差，积分包不含会员权益',
    price: usdFromRmb(9.9),
    points: 800,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 1,
  },
  {
    code: 'small_creator_topup',
    name: '小创作包',
    description: '轻量补充，长期创作建议订阅 Creator',
    price: usdFromRmb(29),
    points: 2500,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 2,
  },
  {
    code: 'standard_topup',
    name: '标准包',
    description: '主推补充包，适合临时增加生成额度',
    price: usdFromRmb(59),
    points: 5500,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 3,
  },
  {
    code: 'pro_topup',
    name: '专业包',
    description: '高频个人补差，订阅仍包含更多权益',
    price: usdFromRmb(199),
    points: 20000,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 4,
  },
  {
    code: 'team_topup',
    name: '团队补差包',
    description: '小团队临时补差，商用授权仍以会员/合同权益为准',
    price: usdFromRmb(599),
    points: 60000,
    validityDays: 365,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    showCommercialLicense: true,
    sort: 5,
  },
  {
    code: 'business_topup',
    name: '商业补差包',
    description: '企业/工作室补差，推荐按 Business 合同单独配置',
    price: usdFromRmb(1999),
    points: 210000,
    validityDays: 365,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    showCommercialLicense: true,
    sort: 6,
  },
];

async function upsertLevel(seed: MembershipLevelSeed) {
  const existing = await prisma.membership_levels.findUnique({
    where: { level: seed.level },
  });

  const data = {
    name: seed.name,
    monthlyPrice: seed.monthlyPrice,
    pointsPerMonth: seed.pointsPerMonth,
    features: seed.features,
    isActive: seed.isActive ?? true,
    sort: seed.sort ?? seed.level,
  };

  if (!existing) {
    const row = await prisma.membership_levels.create({
      data: { ...data, level: seed.level },
    });
    return { row, action: 'created' as const };
  }

  if (!overwrite) {
    return { row: existing, action: 'kept' as const };
  }

  const row = await prisma.membership_levels.update({
    where: { id: existing.id },
    data,
  });
  return { row, action: 'updated' as const };
}

async function upsertPlan(levelId: string, seed: MembershipPlanSeed) {
  const existing = await prisma.membership_plans.findUnique({
    where: {
      levelId_billingCycle_autoRenew: {
        levelId,
        billingCycle: seed.billingCycle,
        autoRenew: seed.autoRenew,
      },
    },
  });

  const data = {
    billingCycle: seed.billingCycle,
    months: seed.months,
    autoRenew: seed.autoRenew,
    originalPrice: seed.originalPrice,
    price: seed.price,
    firstTimePrice: seed.firstTimePrice,
    discountLabel: seed.discountLabel ?? null,
    firstTimeLabel: seed.firstTimeLabel ?? null,
    points: seed.points,
    isActive: true,
    sort: seed.sort,
  };

  if (!existing) {
    await prisma.membership_plans.create({
      data: { ...data, levelId },
    });
    return 'created' as const;
  }

  if (!overwrite) return 'kept' as const;

  await prisma.membership_plans.update({
    where: { id: existing.id },
    data,
  });
  return 'updated' as const;
}

async function upsertPointPackage(seed: PointsPackageSeed) {
  const existing = await prisma.points_packages.findFirst({
    where: {
      OR: [
        { code: seed.code },
        { name: seed.name },
      ],
    },
  });

  const data = {
    name: seed.name,
    description: seed.description,
    price: seed.price,
    points: seed.points,
    validityDays: seed.validityDays,
    usageScope: seed.usageScope,
    showCommercialLicense: seed.showCommercialLicense ?? false,
    isActive: true,
    sort: seed.sort,
  };

  if (!existing) {
    await prisma.points_packages.create({
      data: { ...data, code: seed.code },
    });
    return 'created' as const;
  }

  if (!overwrite) {
    if (!existing.code) {
      await prisma.points_packages.update({
        where: { id: existing.id },
        data: { code: seed.code },
      });
      return 'updated' as const;
    }
    return 'kept' as const;
  }

  await prisma.points_packages.update({
    where: { id: existing.id },
    data: { ...data, code: seed.code },
  });
  return 'updated' as const;
}

async function main() {
  console.log('🌱 [membership-init] start');
  console.log(`🔒 [membership-init] overwrite existing rows: ${overwrite ? 'yes' : 'no'}`);

  const counters = {
    levels: { created: 0, updated: 0, kept: 0 },
    plans: { created: 0, updated: 0, kept: 0 },
    packages: { created: 0, updated: 0, kept: 0 },
  };
  const levelIds = new Map<number, string>();

  for (const seed of levels) {
    const result = await upsertLevel(seed);
    counters.levels[result.action]++;
    levelIds.set(seed.level, result.row.id);
  }

  for (const [levelValue, seeds] of Object.entries(plansByLevel)) {
    const levelId = levelIds.get(Number(levelValue));
    if (!levelId) continue;
    for (const seed of seeds) {
      const action = await upsertPlan(levelId, seed);
      counters.plans[action]++;
    }
  }

  for (const seed of pointPackages) {
    const action = await upsertPointPackage(seed);
    counters.packages[action]++;
  }

  console.log(
    `✅ [membership-init] levels created=${counters.levels.created}, updated=${counters.levels.updated}, kept=${counters.levels.kept}`,
  );
  console.log(
    `✅ [membership-init] plans created=${counters.plans.created}, updated=${counters.plans.updated}, kept=${counters.plans.kept}`,
  );
  console.log(
    `✅ [membership-init] point packages created=${counters.packages.created}, updated=${counters.packages.updated}, kept=${counters.packages.kept}`,
  );
  console.log('🎉 [membership-init] done');
}

main()
  .catch((err) => {
    console.error('❌ [membership-init] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
