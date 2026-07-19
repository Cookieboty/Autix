/**
 * 把视频模型的 paramsSchema 刷成 seed 里的最新定义。
 *
 * 为什么需要它：seedModelSchemas() 是**非破坏性**的 —— 只给「schema 尚未配置」的模型
 * 补默认值，已配置过的一律跳过（否则每次启动都会把运营在 admin 改过的价回退）。
 * 而这次改的恰恰是已配置模型的 schema：
 *   - 补 x-media（输入媒体能力，此前完全没有这一层）
 *   - Seedance 分辨率按上游文档收紧（fast 仅 720p，2.0 仅 720p/1080p）
 *   - Seedance 补 generate_audio（协议层一直支持下发，schema 漏了声明）
 *   - Grok 1.5 / Happy Horse 的 duration 放开成文档给的区间
 *
 * 所以要么带 SEED_FORCE_MODEL_SCHEMAS=1 全量重刷（会连 pricingSchema 一起覆盖，
 * 把运营调过的价冲掉），要么用这个脚本 —— 它**只动 paramsSchema，不碰 pricingSchema**。
 *
 * 用法：
 *   DATABASE_URL=postgresql://... pnpm exec tsx scripts/push-video-model-schemas.ts [--dry-run]
 *
 * 幂等：重复执行结果一致；schema 与目标一致的行会被跳过并如实报告。
 */

import { buildVideoParamsSchema } from './seed-pricing.schemas';
import { VIDEO_MODEL_CONFIGS, VIDEO_INPUT_MEDIA_BY_MODEL, withInputMedia } from './seed-pricing.models';
import { createPrismaClient } from './db';

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = createPrismaClient();

/**
 * 键序无关的稳定序列化。
 *
 * 不能直接比 JSON.stringify：Postgres 的 jsonb 会按自己的规则重排键，取回来的对象
 * 键序与代码里构造的几乎必然不同，裸比对会把「内容完全一致」判成有差异 —— 表现就是
 * 脚本每次都说要更新 10 个，幂等性直接失效（而它本该是这个脚本最基本的保证）。
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function targetParamsSchema(model: {
  provider: string | null;
  model: string;
  metadata: unknown;
}): unknown {
  // 与 seed-pricing.ts 的 paramsSchemaFor 保持同一套取法：per-model 配置优先，
  // 没有的（seedance 系）走通用构造再补挂 x-media。两处若漂了，seed 与本脚本会产出
  // 不同的 schema —— 那正是最难查的一类问题，所以此处刻意复用同样的两个来源。
  const perModel = VIDEO_MODEL_CONFIGS[model.model];
  if (perModel) return perModel.paramsSchema;

  const media = VIDEO_INPUT_MEDIA_BY_MODEL[model.model];
  const schema = buildVideoParamsSchema(model);
  return media ? withInputMedia(schema, media) : schema;
}

async function main() {
  console.log(`push video model paramsSchema${DRY_RUN ? ' (dry run)' : ''}`);

  const models = await prisma.model_configs.findMany({
    where: { OR: [{ type: 'video' }, { capabilities: { has: 'video' } }] },
    select: { id: true, name: true, provider: true, model: true, metadata: true, paramsSchema: true },
    orderBy: { name: 'asc' },
  });

  let updated = 0;
  let unchanged = 0;

  for (const model of models) {
    const next = targetParamsSchema(model);
    // 内容一致就跳过，避免无谓地把 updatedAt 全刷一遍（比对必须键序无关，见 stableStringify）。
    if (stableStringify(model.paramsSchema) === stableStringify(next)) {
      unchanged += 1;
      console.log(`  = ${model.name} (${model.model}) 已是最新`);
      continue;
    }

    const before = model.paramsSchema as { properties?: Record<string, { enum?: unknown[] }> } | null;
    const after = next as { properties?: Record<string, { enum?: unknown[] }> };
    const beforeRes = before?.properties?.resolution?.enum;
    const afterRes = after.properties?.resolution?.enum;
    console.log(
      `  ${DRY_RUN ? '~' : '→'} ${model.name} (${model.model})` +
        `  resolution: ${JSON.stringify(beforeRes)} → ${JSON.stringify(afterRes)}` +
        `  x-media: ${VIDEO_INPUT_MEDIA_BY_MODEL[model.model] ? '已挂' : '（该 model-id 无声明）'}`,
    );

    if (!DRY_RUN) {
      await prisma.model_configs.update({
        where: { id: model.id },
        // 只写 paramsSchema：pricingSchema 可能被运营在 admin 调过，这里绝不覆盖。
        data: { paramsSchema: next as never },
      });
    }
    updated += 1;
  }

  console.log(
    `\n共 ${models.length} 个视频模型：${DRY_RUN ? '将更新' : '已更新'} ${updated}，未变 ${unchanged}`,
  );

  const missing = models.filter((m) => !VIDEO_INPUT_MEDIA_BY_MODEL[m.model]);
  if (missing.length > 0) {
    // 没有 x-media 声明的模型，前端会退到「只接图片、上限 1」的保守交集。
    // 不是错误，但要让人看见——多半是新接了模型却忘了补声明。
    console.warn(
      `\n⚠ 以下模型没有输入媒体声明，前端将按最保守能力处理（仅图片×1）：\n` +
        missing.map((m) => `   - ${m.name} (${m.model})`).join('\n'),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
