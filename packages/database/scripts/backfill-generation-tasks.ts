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
 * 幂等：按 videoGenerationId 跳过已存在的行，重复执行结果一致。
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
  let created = 0;
  let skipped = 0;

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
      const existing = await prisma.generation_tasks.findUnique({
        where: { videoGenerationId: row.id },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.generation_tasks.create({
        data: {
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
      created += 1;
    }
  }

  console.log(`backfill done: created=${created} skipped=${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
