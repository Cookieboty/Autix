#!/usr/bin/env bun
/**
 * 会员 & 积分基础数据种子脚本
 * 用法: bun run --filter=@autix/api seed:membership （从根目录注入 .env）
 * 环境变量: DATABASE_URL
 */

import { BillingCycle, PricingBaseUnit, PricingModelTier } from '@autix/database';
import { createPrismaClient } from './db';

const prisma = createPrismaClient();

// ── Membership Levels ────────────────────────────────────────────────────────

const levels = [
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
  },
  {
    name: 'Starter',
    level: 1,
    monthlyPrice: 29,
    pointsPerMonth: 2500,
    features: {
      removeWatermark: true,
      commercialLicense: false,
      seedance: { enabled: true, maxResolution: '720p', maxDurationSeconds: 5, concurrency: 1 },
      historyRetentionDays: 30,
    },
  },
  {
    name: 'Creator',
    level: 2,
    monthlyPrice: 69,
    pointsPerMonth: 6500,
    features: {
      removeWatermark: true,
      commercialLicense: true,
      seedance: { enabled: true, maxResolution: '1080p', maxDurationSeconds: 10, concurrency: 2 },
      queuePriority: 'normal',
      batchGeneration: 'limited',
      historyRetentionDays: 90,
    },
  },
  {
    name: 'Pro',
    level: 3,
    monthlyPrice: 199,
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
  },
  {
    name: 'Studio',
    level: 4,
    monthlyPrice: 599,
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
  },
  {
    name: 'Business',
    level: 5,
    monthlyPrice: 1999,
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
  },
];

// ── Membership Plans ─────────────────────────────────────────────────────────

interface PlanDef {
  billingCycle: BillingCycle;
  months: number;
  autoRenew: boolean;
  originalPrice: number;
  price: number;
  firstTimePrice: number;
  points: number;
  discountLabel?: string;
}

const freePlans: PlanDef[] = [
  { billingCycle: 'MONTHLY', months: 1, autoRenew: false, originalPrice: 0, price: 0, firstTimePrice: 0, points: 100 },
];

function plans(monthlyPrice: number, monthlyPoints: number): PlanDef[] {
  const yearlyOriginal = monthlyPrice * 12;
  return [
    { billingCycle: 'MONTHLY', months: 1, autoRenew: false, originalPrice: monthlyPrice, price: monthlyPrice, firstTimePrice: monthlyPrice, points: monthlyPoints },
    { billingCycle: 'YEARLY', months: 12, autoRenew: false, originalPrice: yearlyOriginal, price: Math.round(yearlyOriginal * 0.85), firstTimePrice: Math.round(yearlyOriginal * 0.85), points: monthlyPoints, discountLabel: '年付 8.5 折，积分按月发放' },
  ];
}

const plansByLevel: Record<number, PlanDef[]> = {
  0: freePlans,
  1: plans(29, 2500),
  2: plans(69, 6500),
  3: plans(199, 20000),
  4: plans(599, 65000),
  5: [],
};

// ── Points Packages ──────────────────────────────────────────────────────────

const pointsPackages = [
  {
    code: 'trial_topup',
    name: '体验包',
    description: '临时补差，积分包不含会员权益',
    price: 9.9,
    points: 800,
    validityDays: 180,
    sort: 1,
  },
  {
    code: 'small_creator_topup',
    name: '小创作包',
    description: '轻量补充，长期创作建议订阅 Creator',
    price: 29,
    points: 2500,
    validityDays: 180,
    sort: 2,
  },
  {
    code: 'standard_topup',
    name: '标准包',
    description: '主推补充包，适合临时增加生成额度',
    price: 59,
    points: 5500,
    validityDays: 180,
    sort: 3,
  },
  {
    code: 'pro_topup',
    name: '专业包',
    description: '高频个人补差，订阅仍包含更多权益',
    price: 199,
    points: 20000,
    validityDays: 180,
    sort: 4,
  },
  {
    code: 'team_topup',
    name: '团队补差包',
    description: '小团队临时补差，商用授权仍以会员/合同权益为准',
    price: 599,
    points: 60000,
    validityDays: 365,
    showCommercialLicense: true,
    sort: 5,
  },
  {
    code: 'business_topup',
    name: '商业补差包',
    description: '企业/工作室补差，推荐按 Business 合同单独配置',
    price: 1999,
    points: 210000,
    validityDays: 365,
    showCommercialLicense: true,
    sort: 6,
  },
];

const pricingRules = [
  { taskType: 'chat_message_fast', name: '快速对话', baseUnit: PricingBaseUnit.message, baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2, modelTier: PricingModelTier.fast },
  { taskType: 'chat_message_standard', name: '普通对话', baseUnit: PricingBaseUnit.message, baseCost: 3, inputTokenCostPerK: 1, outputTokenCostPerK: 5, modelTier: PricingModelTier.standard },
  { taskType: 'chat_message_reasoning', name: '深度思考对话', baseUnit: PricingBaseUnit.message, baseCost: 10, inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2, modelTier: PricingModelTier.pro_reasoning },
  { taskType: 'gpt_image_2_low', name: '图片工作台 Low', baseUnit: PricingBaseUnit.image, baseCost: 15, quality: 'low' },
  { taskType: 'gpt_image_2_medium', name: '图片工作台 Medium', baseUnit: PricingBaseUnit.image, baseCost: 90, quality: 'medium' },
  { taskType: 'gpt_image_2_high', name: '图片工作台 High', baseUnit: PricingBaseUnit.image, baseCost: 350, quality: 'high' },
  { taskType: 'image_generation', name: '图片模板生成', baseUnit: PricingBaseUnit.image, baseCost: 90 },
  { taskType: 'seedance_fast_720p', name: 'Seedance Fast 720p', baseUnit: PricingBaseUnit.second, baseCost: 260, resolution: '720p' },
  { taskType: 'seedance_480p', name: 'Seedance 480p', baseUnit: PricingBaseUnit.second, baseCost: 160, resolution: '480p' },
  { taskType: 'seedance_720p', name: 'Seedance 720p', baseUnit: PricingBaseUnit.second, baseCost: 320, resolution: '720p' },
  { taskType: 'seedance_1080p', name: 'Seedance 1080p', baseUnit: PricingBaseUnit.second, baseCost: 800, resolution: '1080p' },
  { taskType: 'video_generation', name: '视频模板生成', baseUnit: PricingBaseUnit.second, baseCost: 320 },
  { taskType: 'prompt_optimize_generation', name: '图片工作台 Prompt 优化', baseUnit: PricingBaseUnit.task, baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
  { taskType: 'prompt_optimize_pro', name: 'Artifact 文档 AI 优化', baseUnit: PricingBaseUnit.task, baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
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
        isActive: l.isActive ?? true,
        sort: l.level,
      },
      update: {
        name: l.name,
        monthlyPrice: l.monthlyPrice,
        pointsPerMonth: l.pointsPerMonth,
        features: l.features,
        isActive: l.isActive ?? true,
      },
    });
    levelMap.set(l.level, row.id);
    console.log(`   ✅ ${l.name} (level=${l.level})`);
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
          points: p.points,
          sort: planCount,
        },
        update: {
          months: p.months,
          originalPrice: p.originalPrice,
          price: p.price,
          firstTimePrice: p.firstTimePrice,
          discountLabel: p.discountLabel,
          points: p.points,
        },
      });
      planCount++;
    }
    console.log(`   ✅ Level ${level}: ${plans.length} 个套餐`);
  }
  console.log(`   共 ${planCount} 个套餐`);

  // 3. Points Packages
  console.log('');
  console.log('── 积分包 ──');
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
      sort: pkg.sort,
    };
    if (existing) {
      await prisma.points_packages.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.points_packages.create({
        data,
      });
    }
    console.log(`   ✅ ${pkg.name}: ¥${pkg.price} → ${pkg.points} 积分，有效期 ${pkg.validityDays} 天`);
  }

  // 4. Generation Pricing Rules
  console.log('');
  console.log('── 可配置计费规则 ──');
  for (const rule of pricingRules) {
    await prisma.generation_pricing_rules.upsert({
      where: { taskType_name: { taskType: rule.taskType, name: rule.name } },
      create: rule,
      update: rule,
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
