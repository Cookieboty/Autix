#!/usr/bin/env bun
/**
 * 会员 & 积分基础数据种子脚本
 * 用法: bun run --filter=@autix/api seed:membership （从根目录注入 .env）
 * 环境变量: DATABASE_URL
 */

import { BillingCycle, PricingBaseUnit, PricingComponentType, Prisma } from '@autix/database';
import { createPrismaClient } from './db';

const prisma = createPrismaClient();

// ── Membership Levels ────────────────────────────────────────────────────────

const levels = [
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

// ── Membership Plans ─────────────────────────────────────────────────────────

interface PlanDef {
  billingCycle: typeof BillingCycle.MONTHLY | typeof BillingCycle.YEARLY;
  months: number;
  autoRenew: true;
  originalPrice: number;
  price: number;
  firstTimePrice: null;
  points: number;
  discountLabel: null;
  firstTimeLabel: null;
  sort: number;
}

function plans(monthlyPrice: number, monthlyPoints: number): PlanDef[] {
  const yearlyPrice = Number((monthlyPrice * 12).toFixed(2));
  return [
    { billingCycle: BillingCycle.MONTHLY, months: 1, autoRenew: true, originalPrice: monthlyPrice, price: monthlyPrice, firstTimePrice: null, points: monthlyPoints, discountLabel: null, firstTimeLabel: null, sort: 1 },
    { billingCycle: BillingCycle.YEARLY, months: 12, autoRenew: true, originalPrice: yearlyPrice, price: yearlyPrice, firstTimePrice: null, points: monthlyPoints, discountLabel: null, firstTimeLabel: null, sort: 2 },
  ];
}

const plansByLevel: Record<number, PlanDef[]> = {
  1: plans(19.9, 11000),
  2: plans(59.9, 31100),
  3: plans(99.9, 51200),
};

// ── Points Packages ──────────────────────────────────────────────────────────

const pointsPackages = [
  {
    code: 'trial_topup',
    name: '体验包',
    description: '订阅会员可购买的临时补充积分包',
    price: 9.9,
    points: 800,
    validityDays: 180,
    sort: 1,
  },
  {
    code: 'small_creator_topup',
    name: '小创作包',
    description: '轻量补充积分，适合低频补差',
    price: 29,
    points: 2500,
    validityDays: 180,
    sort: 2,
  },
  {
    code: 'standard_topup',
    name: '标准包',
    description: '适合持续创作中的临时补充额度',
    price: 59,
    points: 5500,
    validityDays: 180,
    sort: 3,
  },
  {
    code: 'pro_topup',
    name: '专业包',
    description: '高频个人补差，需已有有效订阅会员',
    price: 199,
    points: 20000,
    validityDays: 180,
    sort: 4,
  },
  {
    code: 'team_topup',
    name: '团队补差包',
    description: '小团队临时补差，商用授权仍以会员权益为准',
    price: 599,
    points: 60000,
    validityDays: 365,
    showCommercialLicense: true,
    sort: 5,
  },
];

const activeLevelNumbers = levels.map((level) => level.level);
const activePointPackageCodes = pointsPackages.map((pkg) => pkg.code);

type PricingRuleComponentSeed = {
  componentType: PricingComponentType;
  unitCost?: number;
  multiplier?: number;
  config?: Record<string, unknown>;
  sort: number;
};

type PricingRuleSeed = {
  taskType: string;
  name: string;
  baseUnit: PricingBaseUnit;
  priority?: number;
  conditions?: Record<string, unknown> | null;
  refundPolicy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  components: PricingRuleComponentSeed[];
};

const pricingRules: PricingRuleSeed[] = [
  {
    taskType: 'chat_message_fast',
    name: '快速对话',
    baseUnit: PricingBaseUnit.message,
    conditions: { modelTier: 'fast' },
    components: [
      { componentType: PricingComponentType.base, unitCost: 1, sort: 10 },
      { componentType: PricingComponentType.input_token_per_1k, unitCost: 0.5, sort: 30 },
      { componentType: PricingComponentType.output_token_per_1k, unitCost: 2, sort: 40 },
    ],
  },
  {
    taskType: 'chat_message_standard',
    name: '普通对话',
    baseUnit: PricingBaseUnit.message,
    conditions: { modelTier: 'standard' },
    components: [
      { componentType: PricingComponentType.base, unitCost: 3, sort: 10 },
      { componentType: PricingComponentType.input_token_per_1k, unitCost: 1, sort: 30 },
      { componentType: PricingComponentType.output_token_per_1k, unitCost: 5, sort: 40 },
    ],
  },
  {
    taskType: 'chat_message_reasoning',
    name: '深度思考对话',
    baseUnit: PricingBaseUnit.message,
    conditions: { modelTier: 'pro_reasoning' },
    components: [
      { componentType: PricingComponentType.base, unitCost: 10, sort: 10 },
      { componentType: PricingComponentType.input_token_per_1k, unitCost: 3, sort: 30 },
      { componentType: PricingComponentType.output_token_per_1k, unitCost: 15, sort: 40 },
      { componentType: PricingComponentType.reasoning_multiplier, multiplier: 1.2, sort: 100 },
    ],
  },
  {
    taskType: 'gpt_image_2_low',
    name: '图片工作台 Low',
    baseUnit: PricingBaseUnit.image,
    conditions: { quality: 'low' },
    components: [{ componentType: PricingComponentType.per_image, unitCost: 15, sort: 10 }],
  },
  {
    taskType: 'gpt_image_2_medium',
    name: '图片工作台 Medium',
    baseUnit: PricingBaseUnit.image,
    conditions: { quality: 'medium' },
    components: [{ componentType: PricingComponentType.per_image, unitCost: 90, sort: 10 }],
  },
  {
    taskType: 'gpt_image_2_high',
    name: '图片工作台 High',
    baseUnit: PricingBaseUnit.image,
    conditions: { quality: 'high' },
    components: [{ componentType: PricingComponentType.per_image, unitCost: 350, sort: 10 }],
  },
  {
    taskType: 'image_generation',
    name: '图片模板生成',
    baseUnit: PricingBaseUnit.image,
    components: [{ componentType: PricingComponentType.per_image, unitCost: 90, sort: 10 }],
  },
  {
    taskType: 'seedance_fast_720p',
    name: 'Seedance Fast 720p',
    baseUnit: PricingBaseUnit.second,
    conditions: { resolution: '720p' },
    components: [{ componentType: PricingComponentType.per_second, unitCost: 260, sort: 10 }],
  },
  {
    taskType: 'seedance_480p',
    name: 'Seedance 480p',
    baseUnit: PricingBaseUnit.second,
    conditions: { resolution: '480p' },
    components: [{ componentType: PricingComponentType.per_second, unitCost: 160, sort: 10 }],
  },
  {
    taskType: 'seedance_720p',
    name: 'Seedance 720p',
    baseUnit: PricingBaseUnit.second,
    conditions: { resolution: '720p' },
    components: [{ componentType: PricingComponentType.per_second, unitCost: 320, sort: 10 }],
  },
  {
    taskType: 'seedance_1080p',
    name: 'Seedance 1080p',
    baseUnit: PricingBaseUnit.second,
    conditions: { resolution: '1080p' },
    components: [{ componentType: PricingComponentType.per_second, unitCost: 800, sort: 10 }],
  },
  {
    taskType: 'video_generation',
    name: '视频模板生成',
    baseUnit: PricingBaseUnit.second,
    components: [{ componentType: PricingComponentType.per_second, unitCost: 320, sort: 10 }],
  },
  {
    taskType: 'prompt_optimize_generation',
    name: '图片工作台 Prompt 优化',
    baseUnit: PricingBaseUnit.task,
    components: [
      { componentType: PricingComponentType.base, unitCost: 1, sort: 10 },
      { componentType: PricingComponentType.input_token_per_1k, unitCost: 0.5, sort: 30 },
      { componentType: PricingComponentType.output_token_per_1k, unitCost: 2, sort: 40 },
    ],
  },
  {
    taskType: 'prompt_optimize_pro',
    name: 'Artifact 文档 AI 优化',
    baseUnit: PricingBaseUnit.task,
    components: [
      { componentType: PricingComponentType.base, unitCost: 1, sort: 10 },
      { componentType: PricingComponentType.input_token_per_1k, unitCost: 0.5, sort: 30 },
      { componentType: PricingComponentType.output_token_per_1k, unitCost: 2, sort: 40 },
    ],
  },
];

const obsoletePricingTaskTypes = [
  'long_context_chat',
  'tool_call',
  'prompt_optimize_quick',
  'prompt_template_generation',
  'prompt_optimize_batch',
];

const obsoletePricingRuleNames = [
  { taskType: 'chat_message_fast', name: '普通快速对话' },
  { taskType: 'chat_message_standard', name: '高质量对话' },
  { taskType: 'chat_message_reasoning', name: '深度思考' },
  { taskType: 'prompt_optimize_pro', name: '专业优化 Prompt' },
  { taskType: 'prompt_optimize_generation', name: '图片/视频 Prompt 增强' },
  { taskType: 'gpt_image_2_low', name: 'GPT Image 2 Low' },
  { taskType: 'gpt_image_2_medium', name: 'GPT Image 2 Medium' },
  { taskType: 'gpt_image_2_high', name: 'GPT Image 2 High' },
];

function nullableJson(value: Record<string, unknown> | null | undefined) {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function optionalJson(value: Record<string, unknown> | undefined) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ── Execute ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 开始种入会员 & 积分基础数据...');
  console.log(`   数据库: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
  console.log('');

  // 1. Membership Levels
  console.log('── 会员等级 ──');
  const levelMap = new Map<number, string>();
  for (const l of levels) {
    const row = await prisma.membership_levels.upsert({
      where: { level: l.level },
      create: {
        name: l.name,
        level: l.level,
        monthlyPrice: l.monthlyPrice,
        pointsPerMonth: l.pointsPerMonth,
        features: l.features,
        isActive: true,
        sort: l.sort,
      },
      update: {
        name: l.name,
        monthlyPrice: l.monthlyPrice,
        pointsPerMonth: l.pointsPerMonth,
        features: l.features,
        isActive: true,
        sort: l.sort,
      },
    });
    levelMap.set(l.level, row.id);
    console.log(`   ✅ ${l.name} (level=${l.level})`);
  }
  const retiredLevels = await prisma.membership_levels.updateMany({
    where: { level: { notIn: activeLevelNumbers } },
    data: { isActive: false, sort: 999 },
  });
  await prisma.membership_plans.updateMany({
    where: { level: { level: { notIn: activeLevelNumbers } } },
    data: { isActive: false },
  });
  if (retiredLevels.count > 0) {
    console.log(`   🧹 已下架 ${retiredLevels.count} 个旧会员等级`);
  }

  // 2. Membership Plans
  console.log('');
  console.log('── 会员套餐 ──');
  let planCount = 0;
  for (const [level, plans] of Object.entries(plansByLevel)) {
    const levelId = levelMap.get(Number(level))!;
    for (const p of plans) {
      await prisma.membership_plans.upsert({
        where: {
          levelId_billingCycle_autoRenew: {
            levelId,
            billingCycle: p.billingCycle,
            autoRenew: p.autoRenew,
          },
        },
        create: {
          levelId,
          billingCycle: p.billingCycle,
          months: p.months,
          autoRenew: p.autoRenew,
          originalPrice: p.originalPrice,
          price: p.price,
          firstTimePrice: p.firstTimePrice,
          discountLabel: p.discountLabel,
          firstTimeLabel: p.firstTimeLabel,
          points: p.points,
          isActive: true,
          sort: p.sort,
        },
        update: {
          months: p.months,
          autoRenew: p.autoRenew,
          originalPrice: p.originalPrice,
          price: p.price,
          firstTimePrice: p.firstTimePrice,
          discountLabel: p.discountLabel,
          firstTimeLabel: p.firstTimeLabel,
          points: p.points,
          isActive: true,
          sort: p.sort,
        },
      });
      planCount++;
    }
    await prisma.membership_plans.updateMany({
      where: {
        levelId,
        OR: [
          { autoRenew: false },
          { billingCycle: BillingCycle.QUARTERLY },
        ],
      },
      data: { isActive: false },
    });
    console.log(`   ✅ Level ${level}: ${plans.length} 个套餐`);
  }
  console.log(`   共 ${planCount} 个套餐`);

  // 3. Points Packages
  console.log('');
  console.log('── 积分包 ──');
  let packageCount = 0;
  for (const pkg of pointsPackages) {
    const existing = await prisma.points_packages.findFirst({
      where: { OR: [{ code: pkg.code }, { name: pkg.name }] },
    });
    const data = {
      code: pkg.code,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      points: pkg.points,
      validityDays: pkg.validityDays,
      usageScope: { allowedTaskTypes: [], excludedTaskTypes: [] },
      showCommercialLicense: Boolean(pkg.showCommercialLicense),
      isActive: true,
      sort: pkg.sort,
    };
    if (existing) {
      await prisma.points_packages.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.points_packages.create({ data });
    }
    packageCount++;
    console.log(`   ✅ ${pkg.name}: $${pkg.price} → ${pkg.points} 积分，有效期 ${pkg.validityDays} 天`);
  }
  const retiredPackages = await prisma.points_packages.updateMany({
    where: {
      OR: [
        { code: { notIn: activePointPackageCodes } },
        { code: null },
      ],
    },
    data: { isActive: false, sort: 999 },
  });
  if (retiredPackages.count > 0) {
    console.log(`   🧹 已下架 ${retiredPackages.count} 个积分包`);
  }
  console.log(`   共 ${packageCount} 个积分包`);

  // 4. Generation Pricing Rules
  console.log('');
  console.log('── 可配置计费规则 ──');
  for (const rule of pricingRules) {
    const { components, ...ruleFields } = rule;
    const ruleData = {
      ...ruleFields,
      priority: rule.priority ?? 0,
      conditions: nullableJson(rule.conditions),
      refundPolicy: nullableJson(rule.refundPolicy),
      metadata: nullableJson(rule.metadata),
      isActive: true,
    };
    const row = await prisma.generation_pricing_rules.upsert({
      where: { taskType_name: { taskType: rule.taskType, name: rule.name } },
      create: ruleData,
      update: ruleData,
    });
    await prisma.generation_pricing_rule_components.deleteMany({ where: { ruleId: row.id } });
    await prisma.generation_pricing_rule_components.createMany({
      data: components.map((component) => ({
        ...component,
        config: optionalJson(component.config),
        ruleId: row.id,
      })),
    });
    console.log(`   ✅ ${rule.taskType} (${rule.name})`);
  }
  const deletedObsoleteRules = await prisma.generation_pricing_rules.deleteMany({
    where: {
      OR: [
        { taskType: { in: obsoletePricingTaskTypes } },
        ...obsoletePricingRuleNames.map((rule) => ({
          taskType: rule.taskType,
          name: rule.name,
        })),
      ],
    },
  });
  if (deletedObsoleteRules.count > 0) {
    console.log(`   🧹 已删除 ${deletedObsoleteRules.count} 条旧计费规则`);
  }

  console.log('');
  console.log('🎉 会员 & 积分基础数据种入完成!');
}

main()
  .catch((err) => {
    console.error('❌ 种子脚本失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
