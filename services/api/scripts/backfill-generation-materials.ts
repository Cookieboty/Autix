#!/usr/bin/env tsx
/**
 * backfill-generation-materials.ts
 *
 * One-time backfill: 把历史的 image_generations / video_clip_generations 产物补进
 * material_assets（librarySource='GENERATION'）。
 *
 * 背景：生成内容进素材库是从「生成流程内联写入」那次改动才开始的
 * （LlmRepository.createCompletedImageGenerationResult），在那之前的生成物只存在于
 * 流水表里，/asset 页面看不到。本脚本负责补齐存量。
 *
 * 幂等 —— 依赖 partial unique index material_assets_generation_source_uniq
 * + skipDuplicates，重跑不会产生重复行。索引刻意不带 deletedAt 条件，
 * 因此用户已删除的生成素材**不会**被本脚本复活。
 *
 * 行映射与生成流程共用 buildGenerationMaterialRows，避免两条路径写出不同形状的行。
 *
 * Usage:
 *   DATABASE_URL=postgresql://... pnpm exec tsx scripts/backfill-generation-materials.ts
 *   加 --dry-run 只统计不写入。
 */

import { createPrismaClient } from './db';
import { buildGenerationMaterialRows } from '../src/domains/creation/materials/generation-library';

const prisma = createPrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
/** 分批游标翻页，避免把整张流水表读进内存。 */
const BATCH = 500;

async function backfillImages() {
  let cursor: string | undefined;
  let scanned = 0;
  let inserted = 0;

  for (;;) {
    const rows = await prisma.image_generations.findMany({
      where: { status: 'completed' },
      select: {
        id: true,
        userId: true,
        resolvedPrompt: true,
        generatedImages: true,
        modelUsed: true,
        width: true,
        height: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    scanned += rows.length;

    const data = rows.flatMap((row) =>
      buildGenerationMaterialRows({
        userId: row.userId,
        generationId: row.id,
        urls: row.generatedImages,
        prompt: row.resolvedPrompt,
        kind: 'image',
        createdAt: row.createdAt,
        metadata: {
          modelUsed: row.modelUsed,
          width: row.width ?? null,
          height: row.height ?? null,
        },
      }),
    );

    if (data.length > 0 && !DRY_RUN) {
      const { count } = await prisma.material_assets.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += count;
    } else {
      inserted += data.length;
    }
    process.stdout.write(`  image_generations: scanned=${scanned} rows=${inserted}\r`);
  }

  console.log(`\n  image_generations: scanned=${scanned} ${DRY_RUN ? 'would insert' : 'inserted'}=${inserted}`);
}

/**
 * video_clip_generations 的存量补齐。
 *
 * /ai/video 的直连生成、分镜与项目生成都落在这张表。它写素材库是从「三个完成入口
 * 内联写入」那次改动才开始的，之前的存量只能靠这里补。
 * （早期还有一张 video_generations 流水表，从未产出过内容，已随死链路一并删除。）
 *
 * 单条记录只有一个产物（videoUrl），封面取 lastFrameUrl —— 与运行时写入路径
 * （VideoGenerationRepository.persistGeneratedVideoAsset）保持一致的行形状。
 */
async function backfillClipVideos() {
  let cursor: string | undefined;
  let scanned = 0;
  let inserted = 0;

  for (;;) {
    const rows = await prisma.video_clip_generations.findMany({
      where: { status: 'completed', videoUrl: { not: null } },
      select: {
        id: true,
        userId: true,
        resolvedPrompt: true,
        videoUrl: true,
        lastFrameUrl: true,
        durationSec: true,
        model: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    scanned += rows.length;

    const data = rows.flatMap((row) =>
      buildGenerationMaterialRows({
        userId: row.userId,
        generationId: row.id,
        urls: [row.videoUrl as string],
        prompt: row.resolvedPrompt,
        kind: 'video',
        thumbnailUrl: row.lastFrameUrl,
        createdAt: row.createdAt,
        metadata: { modelUsed: row.model, durationSec: row.durationSec },
      }),
    );

    if (data.length > 0 && !DRY_RUN) {
      const { count } = await prisma.material_assets.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += count;
    } else {
      inserted += data.length;
    }
    process.stdout.write(`  video_clip_generations: scanned=${scanned} rows=${inserted}\r`);
  }

  console.log(
    `\n  video_clip_generations: scanned=${scanned} ${DRY_RUN ? 'would insert' : 'inserted'}=${inserted}`,
  );
}

async function main() {
  console.log(`backfill generation → material_assets${DRY_RUN ? ' (dry run)' : ''}`);
  await backfillImages();
  await backfillClipVideos();
  console.log('done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
