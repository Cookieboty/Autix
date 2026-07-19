import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenLeaves } from './i18n/merge-locales.core';
import { CHUNKS } from '../packages/i18n/src/messages';
import { ROUTE_POLICY } from '../clients/web/lib/i18n/route-policy';
import { loadLocaleTree } from '../services/api/src/domains/platform/i18n/locale-loader';

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
 * 后端错误文案，与 `packages/i18n` 完全独立的一套：扁平点分键的 YAML，插值语法是
 * `{{name}}`（前端走 next-intl 的 `{name}`）。这套文件长期不在本脚本覆盖范围内，
 * 于是 ja/fr/ru/vi 四份纯英文占位文件（与 en.yaml 逐字节相同）潜伏了数月无人发现。
 */
const API_LOCALE_DIR = 'services/api/src/domains/platform/i18n/locales';

/** 前端 catalog 未译条目数的棘轮基线，详见 `assertUntranslatedRatchet`。 */
const BASELINE_FILE = 'scripts/i18n/untranslated-baseline.json';

/** 各域硬编码中文异常数的棘轮基线，详见 `assertCjkExceptionRatchet`。 */
const CJK_BASELINE_FILE = 'scripts/i18n/cjk-exception-baseline.json';

/** `services/api/src/domains` 下参与棘轮统计的业务域。 */
const API_DOMAIN_ROOT = 'services/api/src/domains';

/**
 * 允许各语言使用**不同**占位符的键——极少数，必须逐个论证。
 *
 * 目前只有折扣文案：中文习惯说"折"（8折 = 打八折 = 便宜 20%），英文说 "% OFF"，
 * 两者是不同的数字而非同一变量改名，无法互相换算复用。
 * `packages/shared-ui/src/growth/discount.ts` 的 `buildDiscountTranslationValues()`
 * 同时传入 `percent` 和 `zhe` 两个值，所以中英各取所需都能正确渲染。
 *
 * 加新条目前先确认调用方**确实**传了该语言用到的所有变量，否则运行时会抛
 * MISSING_VALUE——这个豁免名单绕过的正是唯一能发现该问题的检查。
 */
const PLACEHOLDER_EXEMPT: ReadonlySet<string> = new Set([
  'publicGrowth.generator.studio.topPromo',
  'publicGrowth.pricing.yearlyDiscountBadge',
]);

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

/** 提取 API YAML 的 `{{name}}` 插值名，含重复、按字典序，便于直接比较。 */
export function extractMustacheArgs(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

/**
 * 提取 next-intl / ICU 文案里的参数名。
 *
 * 关键点是只取参数名，不取 `plural` / `select` 的分支关键字：
 * `{count, plural, one {# item} other {# items}}` 的参数是 `count`，而 `one`/`other`
 * 是 ICU 关键字。把它们当参数会让每一条**正确**的复数翻译都显示成占位符错配——
 * 各语言的复数分支数量本来就不同（俄语有 one/few/many）。
 */
export function extractIcuArgs(value: string): string[] {
  return [...stripIcuQuotes(value).matchAll(/\{\s*(\w+)\s*(?:,|\})/g)].map((m) => m[1]).sort();
}

/**
 * 去掉 ICU 的单引号转义段，因为里面的花括号是**字面量**而非占位符。
 *
 * ICU 规则：`'` 后面紧跟 `{` 或 `}` 时开启转义，直到下一个 `'` 为止；`''` 表示一个
 * 真正的撇号。所以 `Use '{varName}' placeholders` 展示给用户的就是字面的
 * `{varName}`——它是在向用户说明占位符语法。译者把它本地化成 `{变量名}` /
 * `{nomVariable}` 是完全正确的，不加这一步会把每条正确翻译都误报成占位符错配。
 *
 * 注意不能无脑删所有 `'…'`：法语 `l'utilisateur`、英语 `don't` 里的撇号后面没有花括号，
 * 不构成转义，删掉会连带吞掉真正的占位符。
 */
function stripIcuQuotes(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== "'") {
      out += value[i];
      continue;
    }
    if (value[i + 1] === "'") {
      i++; // `''` —— 字面撇号，不开启转义
      continue;
    }
    if (value[i + 1] !== '{' && value[i + 1] !== '}') {
      continue; // 普通撇号（l'utilisateur、don't），原样跳过即可
    }
    const end = value.indexOf("'", i + 1);
    if (end === -1) break; // 未闭合的转义：后面全部视为字面量
    i = end;
  }
  return out;
}

/**
 * 校验每个译文携带的占位符集合与基准语言完全一致。
 *
 * 顺序不敏感——译文按自身语法重排 `{{a}}`/`{{b}}` 是正常的；数量和名字敏感——
 * 丢失占位符会让变量凭空消失，多写或拼错（`{{levelName}}` → `{{levelname}}`）
 * 则会把花括号原样渲染给用户。
 */
export function assertPlaceholdersMatch(
  byLang: Record<string, Record<string, string>>,
  baseLang: string,
  extract: (value: string) => string[],
  exempt: ReadonlySet<string> = new Set(),
): string[] {
  const issues: string[] = [];
  const base = byLang[baseLang] ?? {};
  for (const lang of Object.keys(byLang)) {
    if (lang === baseLang) continue;
    for (const [key, baseValue] of Object.entries(base)) {
      if (exempt.has(key)) continue;
      const translated = byLang[lang][key];
      if (translated === undefined) continue; // 缺键由 assertAligned 负责报告
      const want = extract(baseValue);
      const got = extract(translated);
      if (want.join(' ') === got.join(' ')) continue;
      const lost = want.filter((a) => !got.includes(a));
      const added = got.filter((a) => !want.includes(a));
      const detail = [
        lost.length ? `缺少 ${lost.join(', ')}` : '',
        added.length ? `多出 ${added.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('；');
      issues.push(`[placeholder:${lang}] ${key} — ${detail || '占位符数量不一致'}`);
    }
  }
  return issues;
}

/** 统计各语言中与基准语言逐字节相同的值——即从未被翻译的条目。 */
export function countUntranslated(
  byLang: Record<string, Record<string, string>>,
  baseLang: string,
): Record<string, number> {
  const base = byLang[baseLang] ?? {};
  const counts: Record<string, number> = {};
  for (const lang of Object.keys(byLang)) {
    if (lang === baseLang) continue;
    counts[lang] = Object.entries(base).filter(([k, v]) => byLang[lang][k] === v).length;
  }
  return counts;
}

/**
 * 未译条目数的棘轮：只许降、不许升。
 *
 * 前端 catalog 存量有上千条未译文案，一次性清零不现实，硬失败会让 `i18n:check`
 * 长期红着从而被忽略。棘轮让存量债务不挡路，但新增未译键会被立刻拦住。
 *
 * 低于基线同样报错——否则基线只会单调上漂，翻译推进后不再有约束力，检查就退化成
 * 了摆设。要求同步下调基线，才能把已完成的翻译成果锁住。
 */
export function assertUntranslatedRatchet(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): string[] {
  const issues: string[] = [];
  for (const lang of Object.keys(counts).sort()) {
    const actual = counts[lang];
    const allowed = baseline[lang] ?? 0;
    if (actual > allowed) {
      issues.push(
        `[untranslated:${lang}] ${actual} 条未译 > 基线 ${allowed}（新增 ${actual - allowed} 条）。` +
          `请翻译新增的键，不要上调基线。`,
      );
    } else if (actual < allowed) {
      issues.push(
        `[untranslated:${lang}] ${actual} 条未译 < 基线 ${allowed}——翻译有进展，` +
          `请把 ${BASELINE_FILE} 里的 ${lang} 下调到 ${actual} 以锁住成果。`,
      );
    }
  }
  return issues;
}

/**
 * 统计各域仍在硬编码中文的异常抛出点。
 *
 * 只数抛异常的构造调用，不数普通中文字符串——注释和日志里的中文是本仓库的常态，
 * 一并统计会让基线充满噪声、失去信号。
 */
export function countCjkExceptions(domains: string[]): Record<string, number> {
  const pattern = /(?:throw new \w*Exception\(|throw new Error\()\s*[`'"][^`'"]*[一-鿿]/g;
  const counts: Record<string, number> = {};
  for (const domain of domains) {
    const dir = join(API_DOMAIN_ROOT, domain);
    counts[domain] = existsSync(dir) ? countInDir(dir, pattern) : 0;
  }
  return counts;
}

function countInDir(dir: string, pattern: RegExp): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      total += countInDir(p, pattern);
      continue;
    }
    if (!name.endsWith('.ts') || name.endsWith('.spec.ts')) continue;
    total += (readFileSync(p, 'utf8').match(pattern) ?? []).length;
  }
  return total;
}

/**
 * 各域硬编码中文异常数的棘轮：只许降、不许升。
 *
 * 与 `assertUntranslatedRatchet` 同构。已归零的域基线为 0，再写中文异常立刻失败；
 * 未迁移的域保留存量债务但不允许增长。每迁完一个域把基线降到 0。
 */
export function assertCjkExceptionRatchet(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): string[] {
  const issues: string[] = [];
  for (const domain of Object.keys(counts).sort()) {
    const actual = counts[domain];
    const allowed = baseline[domain] ?? 0;
    if (actual > allowed) {
      issues.push(
        `[cjk-exception:${domain}] ${actual} 处硬编码中文异常 > 基线 ${allowed}` +
          `（新增 ${actual - allowed} 处）。请改用 I18nHttpException + 词条键。`,
      );
    } else if (actual < allowed) {
      issues.push(
        `[cjk-exception:${domain}] ${actual} 处 < 基线 ${allowed}——迁移有进展，` +
          `请把 ${CJK_BASELINE_FILE} 里的 ${domain} 下调到 ${actual} 以锁住成果。`,
      );
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

/**
 * 递归读取 API 侧按域拆分的扁平 YAML 文案表，合并成每语言一张表。
 *
 * 复用生产环境的 `loadLocaleTree`（而非自行手写递归合并），从而继承它的跨文件
 * 撞键硬失败保护——同一语言的同一个 key 在两个域文件里都定义、值还不一样时，
 * 手写的浅合并会静默按遍历顺序丢掉一个，`loadLocaleTree` 会直接抛错。
 *
 * `dir` 可注入，默认指向真实的 `API_LOCALE_DIR`，便于测试用临时目录验证撞键
 * 会被抛出，而不必改动仓库里的真实词条文件。
 */
export function loadApiLocales(dir: string = API_LOCALE_DIR): Record<string, Record<string, string>> {
  const tree = loadLocaleTree(dir);
  return Object.fromEntries(LANGS.map((l) => [l, tree.get(l) ?? {}]));
}

/**
 * API 词条表不得为空。
 *
 * `loadApiLocales()` 早先对缺失文件返回 `{}`，于是词条目录一旦被移动或改名，
 * 后续所有 `[api]` 检查都在空对象上真空通过，`i18n:check` 照常报绿。
 * 空词条表永远是配置错误，不是合法状态——必须响。
 */
export function assertApiCatalogNonEmpty(
  byLang: Record<string, Record<string, string>>,
): string[] {
  return Object.keys(byLang)
    .sort()
    .filter((lang) => Object.keys(byLang[lang]).length === 0)
    .map(
      (lang) =>
        `[api][catalog:${lang}] 未读到任何词条——${API_LOCALE_DIR} 下所有域目录中都缺少 ` +
        `${lang}.yaml（应位于 ${API_LOCALE_DIR}/<domain>/${lang}.yaml），或目录结构已变动。` +
        `空词条表不是合法状态。`,
    );
}

/** 把嵌套的 message 树压平成 `a.b.c -> 字符串值`，用于按值比较。 */
function flattenValues(tree: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flattenLeaves(tree))) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * 汇总所有一致性检查的问题列表——`main()` 的全部业务逻辑都在这里，`main()` 只负责
 * 打印与 exit code。
 *
 * 单独导出是为了让"某项检查被静默漏接"这类回归本身可测：这个脚本此前已经出现过
 * 四次"守卫报绿但从未真正跑过"的事故（详见文件底部 `isDirectRun` 的注释），其中一次
 * 就是有人删掉了把 `assertApiCatalogNonEmpty` 接进 `main()` 的那一行——纯函数单测
 * 全绿，`i18n:check` 也照常报绿，因为没有任何测试断言"main 真的调用了它"。把逻辑
 * 拆成一个可导入、可断言返回值的函数，才能对"接线本身"写回归测试。
 *
 * `apiByLangOverride` 允许测试注入一个空/构造出的 API 词条表，从而不必移动或清空
 * 仓库里真实的 locales 目录就能验证 `assertApiCatalogNonEmpty` 确实被调用到了。
 */
export function collectIssues(
  apiByLangOverride?: Record<string, Record<string, string>>,
): string[] {
  const issues = assertChunkDirsMatchRuntime();
  const byLang = loadMergedByLang(DIR);
  issues.push(...assertAligned(byLang));

  // 前端文案：占位符一致性 + 未译棘轮。基准语言是 en（DEFAULT_LANGUAGE）。
  const webValues = Object.fromEntries(
    LANGS.map((l) => [l, flattenValues(byLang[l])]),
  ) as Record<string, Record<string, string>>;
  issues.push(...assertPlaceholdersMatch(webValues, 'en', extractIcuArgs, PLACEHOLDER_EXEMPT));

  const baseline: Record<string, number> = existsSync(BASELINE_FILE)
    ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
    : {};
  issues.push(...assertUntranslatedRatchet(countUntranslated(webValues, 'en'), baseline));

  // API 错误文案：这套是新纳入的，没有存量债务，所以未译一律硬失败——不给棘轮。
  const apiByLang = apiByLangOverride ?? loadApiLocales();
  issues.push(...assertApiCatalogNonEmpty(apiByLang));
  issues.push(...assertAligned(apiByLang).map((i) => `[api]${i}`));
  issues.push(...assertPlaceholdersMatch(apiByLang, 'en', extractMustacheArgs).map((i) => `[api]${i}`));
  for (const [lang, n] of Object.entries(countUntranslated(apiByLang, 'en'))) {
    if (n > 0) {
      issues.push(
        `[api][untranslated:${lang}] ${API_LOCALE_DIR}/${lang}.yaml 有 ${n} 条值与 en.yaml 逐字相同——未翻译。`,
      );
    }
  }

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

  // 各域硬编码中文异常的棘轮。
  const cjkBaseline: Record<string, number> = existsSync(CJK_BASELINE_FILE)
    ? JSON.parse(readFileSync(CJK_BASELINE_FILE, 'utf8'))
    : {};
  issues.push(
    ...assertCjkExceptionRatchet(countCjkExceptions(Object.keys(cjkBaseline)), cjkBaseline),
  );

  const pages = collectPages(APP_LOCALE_DIR);
  issues.push(...assertRoutePolicyCoverage(pages, Object.keys(ROUTE_POLICY)));

  return issues;
}

function main() {
  const issues = collectIssues();
  if (issues.length) {
    console.error(`i18n 一致性检查失败（${issues.length} 项）:`);
    issues.slice(0, 50).forEach((i) => console.error(`- ${i}`));
    process.exit(1);
  }
  console.log(
    'i18n OK — 前端与 API 文案键对齐、占位符一致；API 无未译条目；' +
      '前端未译数未超基线；route-policy 覆盖全部页面。',
  );
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
