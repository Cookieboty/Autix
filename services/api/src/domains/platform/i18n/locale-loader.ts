import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';

/**
 * 递归读取 `dir` 下所有 `*.yaml`，按文件名（去 `.yaml`）作为语言码归并。
 *
 * 词条表按业务域拆成了子目录（`locales/identity/en.yaml` 等），但运行时仍是同一张
 * 扁平表。目录结构纯粹是为了让并行迁移不在同一个大文件上反复冲突。
 */
export function loadLocaleTree(dir: string): Map<string, Record<string, string>> {
  const tree = new Map<string, Record<string, string>>();
  if (!existsSync(dir)) return tree;

  // 记录每种语言下每个 key 最初来自哪个文件，用于检测跨文件重复 key。
  // readdirSync 的遍历顺序不保证跨平台稳定，如果放任浅合并的 last-write-wins
  // 语义，同一语言两个域文件撞了同一个 key 时，其中一个会被静默吞掉、且吞掉哪个
  // 取决于文件系统的遍历顺序——这种丢失不会报错，只会在运行时表现为某条翻译
  // “莫名其妙”缺失或跟另一条对不上。因此这里必须在归并时就把撞键当作硬错误抛出，
  // 而不是留给运行时排查。
  const keySources = new Map<string, Map<string, string>>();

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

      const sources = keySources.get(lang) ?? new Map<string, string>();
      for (const key of Object.keys(dict)) {
        const existingFile = sources.get(key);
        if (existingFile !== undefined) {
          throw new Error(
            `[locale-loader] 语言 "${lang}" 的 key "${key}" 在多个文件中重复定义：` +
              `${existingFile} 与 ${p}`,
          );
        }
        sources.set(key, p);
      }
      keySources.set(lang, sources);

      tree.set(lang, { ...(tree.get(lang) ?? {}), ...dict });
    }
  };

  walk(dir);
  return tree;
}
