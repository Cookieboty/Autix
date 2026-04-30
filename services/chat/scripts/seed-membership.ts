#!/usr/bin/env bun
/**
 * 会员 & 积分基础数据种子脚本
 * 用法: bun run --filter=@autix/chat seed:membership （从根目录注入 .env）
 * 环境变量: CHAT_DATABASE_URL
 */

import { PrismaClient, BillingCycle } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.CHAT_DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── Membership Levels ────────────────────────────────────────────────────────

const levels = [
  {
    name: 'Plus',
    level: 1,
    monthlyPrice: 39,
    pointsPerMonth: 500,
    features: ['基础AI对话', '标准模型'],
  },
  {
    name: 'Pro',
    level: 2,
    monthlyPrice: 79,
    pointsPerMonth: 1200,
    features: ['高级AI对话', '全部模型', '优先响应'],
  },
  {
    name: 'Ultra',
    level: 3,
    monthlyPrice: 149,
    pointsPerMonth: 2500,
    features: ['无限AI对话', '全部模型', '最高优先级', '专属客服'],
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

const plusPlans: PlanDef[] = [
  { billingCycle: 'MONTHLY', months: 1, autoRenew: false, originalPrice: 39, price: 39, firstTimePrice: 9.9, points: 500 },
  { billingCycle: 'QUARTERLY', months: 3, autoRenew: false, originalPrice: 117, price: 99, firstTimePrice: 79, points: 1500, discountLabel: '省¥18' },
  { billingCycle: 'YEARLY', months: 12, autoRenew: false, originalPrice: 468, price: 349, firstTimePrice: 299, points: 6000, discountLabel: '省¥119' },
  { billingCycle: 'MONTHLY', months: 1, autoRenew: true, originalPrice: 39, price: 35, firstTimePrice: 9.9, points: 500, discountLabel: '自动续费更优惠' },
  { billingCycle: 'QUARTERLY', months: 3, autoRenew: true, originalPrice: 117, price: 89, firstTimePrice: 69, points: 1500 },
  { billingCycle: 'YEARLY', months: 12, autoRenew: true, originalPrice: 468, price: 299, firstTimePrice: 249, points: 6000, discountLabel: '年度最划算' },
];

const proPlans: PlanDef[] = [
  { billingCycle: 'MONTHLY', months: 1, autoRenew: false, originalPrice: 79, price: 79, firstTimePrice: 19.9, points: 1200 },
  { billingCycle: 'QUARTERLY', months: 3, autoRenew: false, originalPrice: 237, price: 199, firstTimePrice: 169, points: 3600, discountLabel: '省¥38' },
  { billingCycle: 'YEARLY', months: 12, autoRenew: false, originalPrice: 948, price: 699, firstTimePrice: 599, points: 14400, discountLabel: '省¥249' },
  { billingCycle: 'MONTHLY', months: 1, autoRenew: true, originalPrice: 79, price: 69, firstTimePrice: 19.9, points: 1200, discountLabel: '自动续费更优惠' },
  { billingCycle: 'QUARTERLY', months: 3, autoRenew: true, originalPrice: 237, price: 179, firstTimePrice: 149, points: 3600 },
  { billingCycle: 'YEARLY', months: 12, autoRenew: true, originalPrice: 948, price: 599, firstTimePrice: 499, points: 14400, discountLabel: '年度最划算' },
];

const ultraPlans: PlanDef[] = [
  { billingCycle: 'MONTHLY', months: 1, autoRenew: false, originalPrice: 149, price: 149, firstTimePrice: 39.9, points: 2500 },
  { billingCycle: 'QUARTERLY', months: 3, autoRenew: false, originalPrice: 447, price: 379, firstTimePrice: 329, points: 7500, discountLabel: '省¥68' },
  { billingCycle: 'YEARLY', months: 12, autoRenew: false, originalPrice: 1788, price: 1299, firstTimePrice: 1099, points: 30000, discountLabel: '省¥489' },
  { billingCycle: 'MONTHLY', months: 1, autoRenew: true, originalPrice: 149, price: 129, firstTimePrice: 39.9, points: 2500, discountLabel: '自动续费更优惠' },
  { billingCycle: 'QUARTERLY', months: 3, autoRenew: true, originalPrice: 447, price: 339, firstTimePrice: 289, points: 7500 },
  { billingCycle: 'YEARLY', months: 12, autoRenew: true, originalPrice: 1788, price: 1099, firstTimePrice: 899, points: 30000, discountLabel: '年度最划算' },
];

const plansByLevel: Record<number, PlanDef[]> = {
  1: plusPlans,
  2: proPlans,
  3: ultraPlans,
};

// ── Points Packages ──────────────────────────────────────────────────────────

const pointsPackages = [
  { name: '小加油包', price: 20, points: 200, sort: 1 },
  { name: '中加油包', price: 50, points: 600, sort: 2 },
  { name: '大加油包', price: 100, points: 1300, sort: 3 },
];

// ── Task Point Costs ─────────────────────────────────────────────────────────

const taskCosts = [
  { taskType: 'simple', name: '简单任务', cost: 50 },
  { taskType: 'medium', name: '中等任务', cost: 100 },
  { taskType: 'advanced', name: '高级任务', cost: 200 },
];

// ── Execute ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 开始种入会员 & 积分基础数据...');
  console.log(`   数据库: ${process.env.CHAT_DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
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
        sort: l.level,
      },
      update: {
        name: l.name,
        monthlyPrice: l.monthlyPrice,
        pointsPerMonth: l.pointsPerMonth,
        features: l.features,
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
      where: { name: pkg.name },
    });
    if (existing) {
      await prisma.points_packages.update({
        where: { id: existing.id },
        data: { price: pkg.price, points: pkg.points, sort: pkg.sort },
      });
    } else {
      await prisma.points_packages.create({
        data: {
          name: pkg.name,
          price: pkg.price,
          points: pkg.points,
          sort: pkg.sort,
        },
      });
    }
    console.log(`   ✅ ${pkg.name}: ¥${pkg.price} → ${pkg.points} 积分`);
  }

  // 4. Task Point Costs
  console.log('');
  console.log('── 任务积分消耗 ──');
  for (const tc of taskCosts) {
    await prisma.task_point_costs.upsert({
      where: { taskType: tc.taskType },
      create: {
        taskType: tc.taskType,
        name: tc.name,
        cost: tc.cost,
      },
      update: {
        name: tc.name,
        cost: tc.cost,
      },
    });
    console.log(`   ✅ ${tc.taskType} (${tc.name}): ${tc.cost} 积分`);
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
