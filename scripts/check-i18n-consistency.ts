import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenLeaves } from './i18n/merge-locales.core';
import { CHUNKS } from '../packages/i18n/src/messages';
import { ROUTE_POLICY } from '../clients/web/lib/i18n/route-policy';

const LANGS = ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'];
const DIR = 'packages/i18n/src/messages';
const APP_LOCALE_DIR = 'clients/web/app/[locale]';

/**
 * `packages/i18n`'s `main` points at `dist/index.js`, and the app loads
 * `dist/messages/**\/*.json` at runtime — never `src/messages/**\/*.json`
 * directly. `dist/` is produced by `pnpm --filter @autix/i18n build`, whose
 * `tsc` step does NOT copy the message JSON files; only the trailing
 * `cp -R src/messages/. dist/messages/` in that build script does. A dev
 * who edits `src/messages/**\/*.json` and forgets to rebuild ships a stale
 * `dist/` with the old keys — `assertAligned` is blind to this because it
 * only ever reads `src/`.
 */
const DIST_DIR = 'packages/i18n/dist/messages';

/**
 * 按 CHUNKS 合并出某个 locale 的完整 message 树——刻意复刻 `loadMessages()` 的
 * 顶层 `Object.assign` 浅合并，使检查对象与运行时真正加载的东西完全一致。
 */
function loadMergedByLang(root: string): Record<string, Record<string, unknown>> {
  const byLang: Record<string, Record<string, unknown>> = {};
  for (const l of LANGS) {
    const merged: Record<string, unknown> = {};
    for (const chunk of CHUNKS) {
      const file = join(root, chunk, `${l}.json`);
      if (!existsSync(file)) continue;
      Object.assign(merged, JSON.parse(readFileSync(file, 'utf8')));
    }
    byLang[l] = merged;
  }
  return byLang;
}

/**
 * 磁盘上的 chunk 目录必须与运行时的 `CHUNKS` 一一对应。
 *
 * 多出来的目录（含手误新建的、或历史遗留未清理的）都是静默丢键的陷阱：
 * `loadMessages()` 只遍历 `CHUNKS`，未声明的 chunk 目录里的键在运行时永远加载不到，
 * 而单看文件系统一切正常。少目录则是漏建 / 漏迁移，会让 `chunkLoaders` 里的
 * dynamic import 在打包时炸掉。
 */
export function assertChunkDirsMatchRuntime(): string[] {
  const onDisk = existsSync(DIR)
    ? readdirSync(DIR).filter((e) => statSync(join(DIR, e)).isDirectory())
    : [];
  const declared = new Set<string>(CHUNKS);
  const issues: string[] = [];
  for (const dir of onDisk) {
    if (!declared.has(dir)) {
      issues.push(
        `[chunk] 目录 messages/${dir}/ 不在 CHUNKS 中——运行时永远不会加载它，其中的键会静默丢失。` +
        `请在 packages/i18n/src/messages.ts 的 CHUNKS/chunkLoaders 中声明，或删除该目录。`,
      );
    }
  }
  for (const chunk of CHUNKS) {
    if (!onDisk.includes(chunk)) {
      issues.push(`[chunk] CHUNKS 声明了 ${chunk}，但 messages/${chunk}/ 不存在。`);
    }
    for (const l of LANGS) {
      if (!existsSync(join(DIR, chunk, `${l}.json`))) {
        issues.push(`[chunk] 缺少 messages/${chunk}/${l}.json`);
      }
    }
  }
  return issues;
}

export function assertAligned(byLang: Record<string, Record<string, unknown>>): string[] {
  const langs = Object.keys(byLang);
  if (langs.length === 0) return [];
  const keySets = Object.fromEntries(
    langs.map((l) => [l, new Set(Object.keys(flattenLeaves(byLang[l])))]),
  );
  const union = new Set<string>();
  langs.forEach((l) => keySets[l].forEach((k) => union.add(k)));
  const issues: string[] = [];
  for (const l of langs) {
    for (const k of union) {
      if (!keySets[l].has(k)) issues.push(`[${l}] missing key: ${k}`);
    }
  }
  return issues;
}

/**
 * Compares each language's flattened key set between `src/messages` and the
 * built `dist/messages`, in both directions (missing AND stale/extra), so a
 * forgotten rebuild after either adding or removing keys gets caught.
 */
export function assertDistMatchesSrc(
  srcByLang: Record<string, Record<string, unknown>>,
  distByLang: Record<string, Record<string, unknown>>,
): string[] {
  const issues: string[] = [];
  for (const l of Object.keys(srcByLang)) {
    const srcKeys = new Set(Object.keys(flattenLeaves(srcByLang[l])));
    const distKeys = new Set(Object.keys(flattenLeaves(distByLang[l] ?? {})));
    for (const k of srcKeys) {
      if (!distKeys.has(k)) {
        issues.push(
          `[dist:${l}] stale dist/messages — missing key (run \`pnpm --filter @autix/i18n build\`): ${k}`,
        );
      }
    }
    for (const k of distKeys) {
      if (!srcKeys.has(k)) {
        issues.push(`[dist:${l}] stale dist/messages — key removed from src but still present: ${k}`);
      }
    }
  }
  return issues;
}

/** 把 `clients/web/app/[locale]/(public)/ai/image/page.tsx` 还原成路由模板 `/ai/image`。 */
export function pageFileToTemplate(file: string): string {
  const rel = file
    .replace(/^clients\/web\/app\/\[locale\]/, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/\([^)]+\)/g, ''); // 剥离路由组，如 (public)、(marketplace-public)
  return rel === '' ? '/' : rel;
}

function collectPages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) collectPages(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

export function assertRoutePolicyCoverage(pages: string[], policyKeys: string[]): string[] {
  const declared = new Set(policyKeys);
  return pages
    .map(pageFileToTemplate)
    .filter((t) => !declared.has(t))
    .map((t) => `[route-policy] 缺少声明: ${t}`);
}

function main() {
  const issues = assertChunkDirsMatchRuntime();
  const byLang = loadMergedByLang(DIR);
  issues.push(...assertAligned(byLang));

  // `packages/i18n/dist/` is gitignored: on a fresh clone before the first
  // `pnpm --filter @autix/i18n build`, it simply doesn't exist yet. That's
  // not a consistency bug — there's nothing built to compare against — so we
  // skip (with a loud warning) rather than hard-failing, which would break
  // `i18n:check` on every clean checkout / first-run CI job before `build`
  // has ever executed.
  //
  // Once `dist/messages` exists (i.e. a build has happened at least once),
  // we do NOT skip again: every subsequent run enforces that it matches
  // `src/messages`. That's deliberate — the failure this survivor exists to
  // catch is exactly "dist/ already exists from a prior build, and someone
  // edited src/ without rebuilding it," which is indistinguishable from a
  // healthy repo unless we diff the two. A silent skip whenever dist/ is
  // present (e.g. only warning) would restore that blind spot; a hard
  // failure only when genuinely absent avoids punishing a clean checkout.
  if (existsSync(DIST_DIR)) {
    issues.push(...assertDistMatchesSrc(byLang, loadMergedByLang(DIST_DIR)));
  } else {
    console.warn(
      `⚠ ${DIST_DIR} not found — skipping src/dist sync check (run \`pnpm --filter @autix/i18n build\` first). Expected on a fresh clone; not expected otherwise.`,
    );
  }

  const pages = collectPages(APP_LOCALE_DIR);
  issues.push(...assertRoutePolicyCoverage(pages, Object.keys(ROUTE_POLICY)));

  if (issues.length) {
    console.error(`i18n 一致性检查失败（${issues.length} 项）:`);
    issues.slice(0, 50).forEach((i) => console.error(`- ${i}`));
    process.exit(1);
  }
  console.log('i18n messages aligned across all languages; route-policy covers all pages.');
}

/**
 * `import.meta.main` 是 Bun / Node 24+ 的特性；本仓库跑 tsx + Node 22，它恒为
 * `undefined`，于是 main() 从未被调用——`pnpm run i18n:check` 长期零输出、exit 0，
 * 看起来一直在通过，实际一次都没执行过。（本文件被 __tests__ import，所以不能
 * 无条件调用 main()，必须有一个真正有效的入口判断。）
 *
 * 识别方法：真正跑通时会打印下面 main() 末尾那行 aligned 日志。零输出 = 没跑。
 */
const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isDirectRun) main();
