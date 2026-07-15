#!/usr/bin/env tsx
/**
 * backfill-resource-metrics.ts
 *
 * One-time backfill: copies legacy count columns (useCount/likeCount/favoriteCount)
 * from image_templates, video_templates, skills, mcp_servers, agents into the
 * unified `resource_metrics` table (referenceCount/likeCount/favoriteCount).
 *
 * Idempotent — always SETs the target columns (never increments), so it is
 * safe to run multiple times; re-running produces the same result.
 *
 * Only referenceCount/likeCount/favoriteCount are touched. pvCount/uvCount/
 * viewCount/hotScore/boostScore are left untouched (0 on create, unchanged on update).
 *
 * Usage:
 *   DATABASE_URL=postgresql://autix:pass@localhost:5432/autix pnpm exec tsx scripts/backfill-resource-metrics.ts
 */

import { getDatabaseUrl, PrismaClient, ResourceType } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

type SourceRow = {
  id: string;
  useCount: number;
  likeCount: number;
  favoriteCount: number;
};

type SourceSpec = {
  resourceType: ResourceType;
  label: string;
  findMany: () => Promise<SourceRow[]>;
};

const sources: SourceSpec[] = [
  {
    resourceType: ResourceType.IMAGE_TEMPLATE,
    label: 'image_templates',
    findMany: () =>
      prisma.image_templates.findMany({
        select: { id: true, useCount: true, likeCount: true, favoriteCount: true },
      }),
  },
  {
    resourceType: ResourceType.VIDEO_TEMPLATE,
    label: 'video_templates',
    findMany: () =>
      prisma.video_templates.findMany({
        select: { id: true, useCount: true, likeCount: true, favoriteCount: true },
      }),
  },
  {
    resourceType: ResourceType.SKILL,
    label: 'skills',
    findMany: () =>
      prisma.skills.findMany({
        select: { id: true, useCount: true, likeCount: true, favoriteCount: true },
      }),
  },
  {
    resourceType: ResourceType.MCP,
    label: 'mcp_servers',
    findMany: () =>
      prisma.mcp_servers.findMany({
        select: { id: true, useCount: true, likeCount: true, favoriteCount: true },
      }),
  },
  {
    resourceType: ResourceType.AGENT,
    label: 'agents',
    findMany: () =>
      prisma.agents.findMany({
        select: { id: true, useCount: true, likeCount: true, favoriteCount: true },
      }),
  },
];

async function backfillSource(spec: SourceSpec): Promise<number> {
  const rows = await spec.findMany();
  let upserted = 0;

  for (const row of rows) {
    const values = {
      referenceCount: row.useCount,
      likeCount: row.likeCount,
      favoriteCount: row.favoriteCount,
    };

    await prisma.resource_metrics.upsert({
      where: {
        resourceType_resourceId: {
          resourceType: spec.resourceType,
          resourceId: row.id,
        },
      },
      update: values,
      create: {
        resourceType: spec.resourceType,
        resourceId: row.id,
        ...values,
      },
    });
    upserted++;
  }

  console.log(`  ✅ ${spec.label}: upserted ${upserted}/${rows.length} rows`);
  return upserted;
}

async function main() {
  console.log('🔧 [backfill-resource-metrics] Starting backfill of legacy counts...');

  let total = 0;
  for (const spec of sources) {
    total += await backfillSource(spec);
  }

  console.log(`\n✅ [backfill-resource-metrics] Done. Total rows upserted: ${total}`);
}

main()
  .catch((e) => {
    console.error('❌ [backfill-resource-metrics] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
