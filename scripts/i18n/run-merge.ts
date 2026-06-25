// 一次性迁移脚本：已用于把 web/desktop 两套 messages 合并到 packages/i18n/src/messages 单一源。
// 迁移已完成后 WEB_DIR / DESKTOP_DIR 两个源目录已被删除，重跑本脚本会因找不到源文件而报错。
// 单一源现由 scripts/check-i18n-consistency.ts（bun run i18n:check）守护；若确需重新合并，
// 请先恢复两端原始 messages 目录再运行。保留此文件仅作迁移过程留档。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLocaleSets, type Lang, type Nested } from './merge-locales.core';

const LANGS: Lang[] = ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'];
const DEFAULT_LANG: Lang = 'zh-CN';
const WEB_DIR = 'clients/web/messages';
const DESKTOP_DIR = 'clients/desktop/src/renderer/i18n/messages';
const OUT_DIR = 'packages/i18n/src/messages';

function load(dir: string): Record<Lang, Nested> {
  const out: Record<Lang, Nested> = {};
  for (const lang of LANGS) {
    out[lang] = JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8'));
  }
  return out;
}

const { merged, report } = mergeLocaleSets({
  web: load(WEB_DIR),
  desktop: load(DESKTOP_DIR),
  langs: LANGS,
  defaultLang: DEFAULT_LANG,
});

mkdirSync(OUT_DIR, { recursive: true });
for (const lang of LANGS) {
  writeFileSync(join(OUT_DIR, `${lang}.json`), JSON.stringify(merged[lang], null, 2) + '\n');
}
writeFileSync(
  'docs/superpowers/plans/i18n-merge-report.json',
  JSON.stringify(report, null, 2) + '\n',
);

console.log(
  `merged ${LANGS.length} langs → ${OUT_DIR} | conflicts=${report.conflicts.length} filled=${report.filled.length}`,
);
