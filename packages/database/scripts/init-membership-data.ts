#!/usr/bin/env bun
/**
 * Initialize the current membership catalog.
 *
 * This script is intentionally authoritative: the membership catalog has only
 * Plus, Pro, and Max. Membership purchases are recurring subscriptions, while
 * points packages remain one-time top-ups for paid members.
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
  sort: number;
};

type MembershipPlanSeed = {
  billingCycle: BillingCycle.MONTHLY | BillingCycle.YEARLY;
  months: number;
  autoRenew: true;
  originalPrice: number;
  price: number;
  points: number;
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

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
});
const prisma = new PrismaClient({ adapter });

const activeLevels: MembershipLevelSeed[] = [
  {
    name: 'Plus',
    level: 1,
    monthlyPrice: 19.9,
    pointsPerMonth: 11000,
    features: {
      basePointsPerMonth: 10000,
      bonusPointsPerMonth: 1000,
      removeWatermark: true,
      commercialLicense: false,
      seedance: { enabled: true, maxResolution: '720p', maxDurationSeconds: 5, concurrency: 1 },
      queuePriority: 'standard',
      batchGeneration: 'limited',
      historyRetentionDays: 30,
    },
    sort: 1,
  },
  {
    name: 'Pro',
    level: 2,
    monthlyPrice: 59.9,
    pointsPerMonth: 31100,
    features: {
      recommended: true,
      basePointsPerMonth: 30000,
      bonusPointsPerMonth: 1100,
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 10, concurrency: 2 },
      queuePriority: 'high',
      batchGeneration: 'enabled',
      historyRetentionDays: 90,
      invoice: 'requestable',
      pointsCarryover: { enabled: true, maxCycles: 1, maxPoints: 31100 },
    },
    sort: 2,
  },
  {
    name: 'Max',
    level: 3,
    monthlyPrice: 99.9,
    pointsPerMonth: 51200,
    features: {
      basePointsPerMonth: 50000,
      bonusPointsPerMonth: 1200,
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 30, concurrency: 4 },
      queuePriority: 'highest',
      batchGeneration: 'enabled',
      historyRetentionDays: 365,
      teamSpace: true,
      invoice: 'included',
      pointsCarryover: { enabled: true, maxCycles: 1, maxPoints: 51200 },
    },
    sort: 3,
  },
];

function plans(monthlyPrice: number, monthlyPoints: number): MembershipPlanSeed[] {
  const yearlyPrice = Number((monthlyPrice * 12).toFixed(2));
  return [
    {
      billingCycle: BillingCycle.MONTHLY,
      months: 1,
      autoRenew: true,
      originalPrice: monthlyPrice,
      price: monthlyPrice,
      points: monthlyPoints,
      sort: 1,
    },
    {
      billingCycle: BillingCycle.YEARLY,
      months: 12,
      autoRenew: true,
      originalPrice: yearlyPrice,
      price: yearlyPrice,
      points: monthlyPoints,
      sort: 2,
    },
  ];
}

const plansByLevel = new Map<number, MembershipPlanSeed[]>(
  activeLevels.map((level) => [
    level.level,
    plans(level.monthlyPrice, level.pointsPerMonth),
  ]),
);

const pointPackages: PointsPackageSeed[] = [
  {
    code: 'trial_topup',
    name: '体验包',
    description: '订阅会员可购买的临时补充积分包',
    price: 9.9,
    points: 800,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 1,
  },
  {
    code: 'small_creator_topup',
    name: '小创作包',
    description: '轻量补充积分，适合低频补差',
    price: 29,
    points: 2500,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 2,
  },
  {
    code: 'standard_topup',
    name: '标准包',
    description: '适合持续创作中的临时补充额度',
    price: 59,
    points: 5500,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 3,
  },
  {
    code: 'pro_topup',
    name: '专业包',
    description: '高频个人补差，需已有有效订阅会员',
    price: 199,
    points: 20000,
    validityDays: 180,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    sort: 4,
  },
  {
    code: 'team_topup',
    name: '团队补差包',
    description: '小团队临时补差，商用授权仍以会员权益为准',
    price: 599,
    points: 60000,
    validityDays: 365,
    usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
    showCommercialLicense: true,
    sort: 5,
  },
];

async function upsertLevel(seed: MembershipLevelSeed) {
  const data = {
    name: seed.name,
    monthlyPrice: seed.monthlyPrice,
    pointsPerMonth: seed.pointsPerMonth,
    features: seed.features,
    isActive: true,
    sort: seed.sort,
  };
  const row = await prisma.membership_levels.upsert({
    where: { level: seed.level },
    create: { ...data, level: seed.level },
    update: data,
  });
  return row;
}

async function syncPlans(levelId: string, seeds: MembershipPlanSeed[]) {
  const activePlanIds: string[] = [];
  for (const seed of seeds) {
    const data = {
      billingCycle: seed.billingCycle,
      months: seed.months,
      autoRenew: seed.autoRenew,
      originalPrice: seed.originalPrice,
      price: seed.price,
      firstTimePrice: null,
      discountLabel: null,
      firstTimeLabel: null,
      points: seed.points,
      isActive: true,
      sort: seed.sort,
    };
    const plan = await prisma.membership_plans.upsert({
      where: {
        levelId_billingCycle_autoRenew: {
          levelId,
          billingCycle: seed.billingCycle,
          autoRenew: seed.autoRenew,
        },
      },
      create: { ...data, levelId },
      update: data,
    });
    activePlanIds.push(plan.id);
  }

  await prisma.membership_plans.updateMany({
    where: {
      levelId,
      id: { notIn: activePlanIds },
    },
    data: { isActive: false },
  });

  return activePlanIds.length;
}

async function upsertPointPackage(seed: PointsPackageSeed) {
  const existing = await prisma.points_packages.findFirst({
    where: { OR: [{ code: seed.code }, { name: seed.name }] },
  });
  const data = {
    code: seed.code,
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
  if (existing) {
    await prisma.points_packages.update({ where: { id: existing.id }, data });
    return 'updated' as const;
  }
  await prisma.points_packages.create({ data });
  return 'created' as const;
}

async function main() {
  console.log('[membership-init] start');

  const activeLevelNumbers = activeLevels.map((level) => level.level);
  const levelIds = new Map<number, string>();

  for (const seed of activeLevels) {
    const row = await upsertLevel(seed);
    levelIds.set(seed.level, row.id);
    console.log(`[membership-init] level synced: ${seed.name} (level=${seed.level})`);
  }

  const retiredLevels = await prisma.membership_levels.updateMany({
    where: { level: { notIn: activeLevelNumbers } },
    data: { isActive: false, sort: 999 },
  });

  await prisma.membership_plans.updateMany({
    where: {
      level: { level: { notIn: activeLevelNumbers } },
    },
    data: { isActive: false },
  });

  let planCount = 0;
  for (const [level, seeds] of plansByLevel.entries()) {
    const levelId = levelIds.get(level);
    if (!levelId) continue;
    planCount += await syncPlans(levelId, seeds);
    console.log(`[membership-init] plans synced: level=${level}, count=${seeds.length}`);
  }

  const activePackageCodes = pointPackages.map((pkg) => pkg.code);
  const packageCounters = { created: 0, updated: 0 };
  for (const seed of pointPackages) {
    const action = await upsertPointPackage(seed);
    packageCounters[action]++;
  }
  const retiredPackages = await prisma.points_packages.updateMany({
    where: {
      OR: [
        { code: { notIn: activePackageCodes } },
        { code: null },
      ],
    },
    data: { isActive: false, sort: 999 },
  });

  console.log(`[membership-init] retired levels=${retiredLevels.count}`);
  console.log(`[membership-init] active plans=${planCount}`);
  console.log(
    `[membership-init] point packages created=${packageCounters.created}, updated=${packageCounters.updated}, retired=${retiredPackages.count}`,
  );
  console.log('[membership-init] done');
}

main()
  .catch((err) => {
    console.error('[membership-init] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
