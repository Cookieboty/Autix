#!/usr/bin/env tsx
/**
 * backfill-generation-tasks.ts
 *
 * One-time backfill: 为所有**非终态**的 video_clip_generations 行创建对应的
 * generation_tasks 行。必须在应用切换到新代码之前（或同一部署窗口内）执行。
 *
 * 为什么必须：终态写入改为「两张表同事务 CAS」后，升级前已在飞行中的任务若无
 * generation_tasks 行，updateMany 会命中 0 行 → CAS 判负 → 终态收敛永久阻塞，
 * hold 也不会结算。
 *
 * 幂等：按 videoGenerationId（唯一约束）upsert，已存在的行原样保留，重复执行结果一致。
 * 计数：console 输出 processed=N（本次遍历到的非终态行总数），不再区分
 * created/skipped —— upsert 本身不暴露走的是哪条分支，若要还原该区分需要在
 * upsert 前后各查一次，等于退回「先查后建」的 2 次往返，抵消 upsert 改造的意义。
 *
 * 时间戳：原样保留源行的毫秒精度时间戳，不重新生成、不截断到秒。
 *
 * Usage:
 *   pnpm --filter @autix/database run db:backfill-generation-tasks
 */

import {
  getDatabaseUrl,
  PrismaClient,
  GenerationKind,
  GenerationTaskStatus,
  VideoGenStatus,
} from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

const NON_TERMINAL: VideoGenStatus[] = [
  VideoGenStatus.pending,
  VideoGenStatus.queued,
  VideoGenStatus.running,
];

const BATCH = 500;

async function main() {
  let cursor: string | undefined;
  let processed = 0;

  for (;;) {
    const rows = await prisma.video_clip_generations.findMany({
      where: { status: { in: NON_TERMINAL } },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      // upsert：DB 层原子去重（唯一约束 videoGenerationId），单次往返，
      // 取代 findUnique + create 的先查后建（每行 2 次往返 + 应用层竞态窗口）。
      // update: {} 表示已存在的行不做任何改动 —— 幂等性由「已存在则原样保留」
      // 保证，且判断与写入在同一条 SQL 语句内原子完成，不再有 TOCTOU 窗口。
      //
      // 计数口径调整：upsert 不会告诉调用方走的是 insert 分支还是「命中已存在
      // 什么都没做」分支，若想还原 created/skipped 就必须在 upsert 前后各加一次
      // 查询，那样又变回 2 次往返，抵消了本次改造的目的。因此改为只报告
      // processed=N（本次遍历到的非终态行总数），不再区分 created/skipped。
      // 幂等性本身不受影响：无论 processed 里有多少行其实是"重复跑到的已存在行"，
      // upsert 保证它们的 generation_tasks 内容不会被二次写入或覆盖。
      await prisma.generation_tasks.upsert({
        where: { videoGenerationId: row.id },
        update: {},
        create: {
          // 复用生成行 id 作为任务 id：回填行没有独立的预生成 id，
          // 复用可保证幂等且便于人工核对。
          id: row.id,
          kind: GenerationKind.VIDEO,
          userId: row.userId,
          // 有 providerTaskId → 已被上游受理 → QUEUED；否则仍在提交阶段 → PENDING。
          status: row.providerTaskId
            ? GenerationTaskStatus.QUEUED
            : GenerationTaskStatus.PENDING,
          model: row.model,
          protocolKey: row.protocolKey,
          providerTaskId: row.providerTaskId,
          modelConfigId: row.modelConfigId,
          prompt: row.resolvedPrompt,
          promptLength: row.resolvedPrompt?.length ?? 0,
          // 原样保留源行毫秒时间戳（Prisma DateTime 已是毫秒精度，直接透传不做任何取整）。
          createdAt: row.createdAt,
          // 回填行没有 submittedAt —— 收敛 cron 的 70 分钟阈值会回退到 createdAt。
          videoGenerationId: row.id,
        },
      });

      processed += 1;
    }
  }

  console.log(`backfill done: processed=${processed}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
