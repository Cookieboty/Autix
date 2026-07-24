/**
 * 前端硬编码 UI 文案扫描器（i18n 盲区补齐）。
 *
 * 检查器此前只扫 API 中文字面量，完全不看前端 JSX——于是「直接写在 JSX 里、绕过
 * next-intl 的用户可见文案」（如 <Button>Like</Button>、placeholder="搜索…"）永远不被发现。
 * 本扫描器用 TS AST 找两类硬编码：
 *   1) JSX 文本节点（标签之间的可见文本），含 2+ 字母/汉字；
 *   2) 面向用户的字符串属性：placeholder / aria-label / title / alt / label。
 *
 * 已尽量降低误报：纯空白/标点/数字/单字符、className/style/key/id/href/src/type/name/role
 * 等非文案属性、`{t('…')}` 之类的表达式（本就不是字面量）、以及 camelCase/点路径这类
 * 代码标识符（schema 字段名、运营诊断键——按分层策略保持内联英文）都不计入。仍可能有
 * 少量误报（如刻意展示的英文品牌词），故按目录做棘轮（只降不升）而非硬清零。
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

const AREAS = ['clients/web', 'packages/shared-ui/src'];
// 不承载用户文案的属性——其字符串值不算硬编码文案。
const NON_TEXT_ATTRS = new Set([
  'className', 'class', 'style', 'key', 'id', 'href', 'src', 'type', 'name', 'role',
  'htmlFor', 'rel', 'target', 'method', 'action', 'value', 'defaultValue', 'width',
  'height', 'viewBox', 'd', 'fill', 'stroke', 'x', 'y', 'cx', 'cy', 'r', 'transform',
  'data-testid', 'testId', 'variant', 'size', 'color', 'align', 'side', 'position',
  'as', 'to', 'slot', 'sideOffset', 'align-items', 'accept', 'autoComplete', 'mode',
  'locale', 'lang', 'dir', 'charSet', 'property', 'content', 'itemProp', 'sizes',
]);
// 承载用户文案的属性——字符串值若含字母/汉字即视为硬编码文案。
const TEXT_ATTRS = new Set(['placeholder', 'aria-label', 'ariaLabel', 'title', 'alt', 'label', 'aria-description']);
const HAS_WORD = /[A-Za-z一-鿿]{2,}/; // 至少一个 2+ 字母/汉字的词

function isMeaningful(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (!HAS_WORD.test(t)) return false; // 纯符号/数字/单字符
  // 明显的非文案：URL、HTML 实体、纯 kebab/snake 标识、模板占位
  if (/^https?:\/\//.test(t)) return false;
  if (/^&(#\d+|#x[0-9a-f]+|[a-z]+);$/i.test(t)) return false; // HTML 实体 &times; &#215;
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(t)) return false; // e.g. data-testid 值 my-thing
  // 代码标识符（单 token，无空格）：camelCase 字段名（providerTaskId / durationMs）与点路径
  // （hold.status）。它们是 schema 字段名 / 运营诊断键，按分层策略保持内联英文——翻成
  // 「协议键」反而破坏运营对照代码的排障心智。自然语言文案必含空格，不会命中这两条。
  if (/^[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/.test(t)) return false; // camelCase 标识符
  if (/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/.test(t)) return false; // 点路径 a.b.c
  return true;
}

function files(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n === '.next') continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) files(p, out);
    else if (n.endsWith('.tsx') && !n.endsWith('.test.tsx') && !n.endsWith('.spec.tsx')) out.push(p);
  }
  return out;
}

function scan(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    // 1) JSX 文本节点
    if (ts.isJsxText(node)) {
      const txt = node.text.replace(/\s+/g, ' ');
      if (isMeaningful(txt)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        hits.push(`${file}:${line + 1}\t${JSON.stringify(txt.trim().slice(0, 60))}`);
      }
    }
    // 2) 面向用户的字符串属性
    if (ts.isJsxAttribute(node) && node.name && ts.isIdentifier(node.name)) {
      const attr = node.name.text;
      if (TEXT_ATTRS.has(attr) && node.initializer) {
        let strVal: string | null = null;
        if (ts.isStringLiteral(node.initializer)) strVal = node.initializer.text;
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const e = node.initializer.expression;
          if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) strVal = e.text;
        }
        if (strVal !== null && isMeaningful(strVal) && !NON_TEXT_ATTRS.has(attr)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          hits.push(`${file}:${line + 1}\t[${attr}] ${JSON.stringify(strVal.slice(0, 60))}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/** 各前端目录的硬编码 UI 文案处数（供 check-i18n-consistency 的棘轮调用）。 */
export function countFrontendHardcodedByArea(): { counts: Record<string, number>; hits: string[] } {
  const byArea: Record<string, number> = {};
  const allHits: string[] = [];
  for (const area of AREAS) {
    let n = 0;
    for (const f of files(area)) { const hs = scan(f); n += hs.length; allHits.push(...hs); }
    byArea[area] = n;
  }
  return { counts: byArea, hits: allHits };
}

// 直接运行时打印统计（被 import 时不执行）。
const isMain = (() => {
  try { return process.argv[1] && process.argv[1].endsWith('scan-frontend-hardcoded.ts'); } catch { return false; }
})();
if (isMain) {
  const { counts, hits } = countFrontendHardcodedByArea();
  console.log('frontend hardcoded UI text: ' + JSON.stringify(counts));
  console.log('TOTAL: ' + Object.values(counts).reduce((a, b) => a + b, 0));
  if (process.env.VERBOSE === '1') console.log('\n' + hits.join('\n'));
}
