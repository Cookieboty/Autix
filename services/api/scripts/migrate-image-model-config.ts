/**
 * 一次性图片模型配置迁移（幂等）：
 *  1. Nano Banana ×3：protocolKey `gemini-images@v1`(OpenAI shim) → `gemini-generate-content@v1`(Gemini 原生)。
 *     鉴权头 x-goog-api-key 已随原生 preset 自带（运营确认）。
 *  2. Seedream ×2：operations `['generate','edit']` → `['generate']`（火山统一端点，无独立 edit）。
 *
 * 默认 **dry-run**（只打印将改什么 + 跑跨配置校验器）。加 `--commit` 才实写库。
 * 不含任何 apiKey/baseUrl —— 密钥/网关地址由运营在 admin 维护。
 *
 * 用法（在 services/api 下）：
 *   dry:    pnpm exec dotenv -e ../../.env -- tsx scripts/migrate-image-model-config.ts
 *   commit: pnpm exec dotenv -e ../../.env -- tsx scripts/migrate-image-model-config.ts --commit
 */
import { PROTOCOL_PRESETS, validateModelProtocolConfig } from '@autix/ai-adapters/image';
import type { ParamsSchema } from '@autix/domain/pricing';
import { createPrismaClient } from './db';

const COMMIT = process.argv.includes('--commit');
const prisma = createPrismaClient();

const PROTOCOL_MIGRATIONS: Record<string, string> = {
  'gemini-3-pro-image-preview-official': 'gemini-generate-content@v1',
  'gemini-3.1-flash-image-preview-official': 'gemini-generate-content@v1',
  'gemini-3.1-flash-lite-image-official': 'gemini-generate-content@v1',
};
const OPERATIONS_MIGRATIONS: Record<string, string[]> = {
  'doubao-seedream-4-5': ['generate'],
  'doubao-seedream-5-0-lite': ['generate'],
};

function endsWithV1(url: unknown): boolean {
  return typeof url === 'string' && /\/v1\/?$/.test(url);
}

async function main() {
  console.log(`=== image model config migration (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===\n`);
  const modelIds = [...Object.keys(PROTOCOL_MIGRATIONS), ...Object.keys(OPERATIONS_MIGRATIONS)];
  const rows = await prisma.model_configs.findMany({
    where: { model: { in: modelIds } },
    select: { id: true, name: true, model: true, baseUrl: true, metadata: true, paramsSchema: true },
  });

  let violationsFound = 0;
  let changed = 0;

  for (const row of rows) {
    const meta = { ...((row.metadata as Record<string, unknown> | null) ?? {}) };
    const changes: string[] = [];

    if (PROTOCOL_MIGRATIONS[row.model] && meta.protocolKey !== PROTOCOL_MIGRATIONS[row.model]) {
      changes.push(`protocolKey: ${JSON.stringify(meta.protocolKey)} -> "${PROTOCOL_MIGRATIONS[row.model]}"`);
      meta.protocolKey = PROTOCOL_MIGRATIONS[row.model];
    }
    if (OPERATIONS_MIGRATIONS[row.model] && JSON.stringify(meta.operations) !== JSON.stringify(OPERATIONS_MIGRATIONS[row.model])) {
      changes.push(`operations: ${JSON.stringify(meta.operations)} -> ${JSON.stringify(OPERATIONS_MIGRATIONS[row.model])}`);
      meta.operations = OPERATIONS_MIGRATIONS[row.model];
    }

    console.log(`── ${row.name} (${row.model})`);
    if (changes.length === 0) {
      console.log('   (already migrated — no change)');
      continue;
    }
    changes.forEach((c) => console.log(`   ${c}`));

    // 用**迁移后**的 metadata 跑跨配置校验器，确认 schema 与新 preset 闭合。
    const preset = PROTOCOL_PRESETS[String(meta.protocolKey)];
    const violations = validateModelProtocolConfig({
      paramsSchema: row.paramsSchema as unknown as ParamsSchema,
      metadata: meta,
      preset,
    });
    if (violations.length > 0) {
      violationsFound += violations.length;
      console.log(`   ❌ VALIDATION FAILED: ${violations.map((v) => v.code).join(', ')}`);
    } else {
      console.log('   ✅ validateModelProtocolConfig: VALID');
    }

    // Gemini 原生透传要求 baseUrl 不带 /v1 后缀（否则拼成 /v1/v1beta/...）。
    if (meta.protocolKey === 'gemini-generate-content@v1' && (endsWithV1(row.baseUrl) || endsWithV1(meta.baseUrl))) {
      console.log(`   ⚠️  baseUrl 带 /v1 后缀（row=${JSON.stringify(row.baseUrl)} meta=${JSON.stringify(meta.baseUrl)}）——Gemini 原生路径是 /v1beta/models/...，需运营在 admin 去掉 /v1，否则 404。迁移脚本不动 baseUrl。`);
    }

    changed += 1;
    if (COMMIT) {
      if (violations.length > 0) {
        console.log('   ⏭  skipped write (validation failed)');
        continue;
      }
      await prisma.model_configs.update({ where: { id: row.id }, data: { metadata: meta } });
      console.log('   💾 written');
    }
  }

  console.log(`\n=== summary: ${changed} model(s) to change, ${violationsFound} validation violation(s) ===`);
  if (!COMMIT) console.log('DRY-RUN only. Re-run with --commit to write (after review).');
  if (violationsFound > 0) process.exitCode = 1;
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
