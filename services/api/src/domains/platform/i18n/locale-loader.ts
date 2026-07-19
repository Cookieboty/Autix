import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';

/**
 * 递归读取 `dir` 下所有 `*.yaml`，按文件名（去 `.yaml`）作为语言码归并。
 *
 * 词条表按业务域拆成了子目录（`locales/identity/en.yaml` 等），但运行时仍是同一张
 * 扁平表——键名里已经带了域前缀，所以浅合并不会撞键。目录结构纯粹是为了让并行迁移
 * 不在同一个大文件上反复冲突。
 */
export function loadLocaleTree(dir: string): Map<string, Record<string, string>> {
  const tree = new Map<string, Record<string, string>>();
  if (!existsSync(dir)) return tree;

  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const p = join(current, name);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!name.endsWith('.yaml')) continue;
      const lang = name.slice(0, -'.yaml'.length);
      const dict = (loadYaml(readFileSync(p, 'utf-8')) ?? {}) as Record<string, string>;
      tree.set(lang, { ...(tree.get(lang) ?? {}), ...dict });
    }
  };

  walk(dir);
  return tree;
}
