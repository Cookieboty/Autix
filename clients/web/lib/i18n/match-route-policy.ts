import { ROUTE_POLICY, type Policy } from './route-policy';

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * 一个路由模板是否匹配给定的（已剥离 locale 前缀的）路径段序列。
 * - 字面量段：精确相等
 * - `[x]` 单动态段：匹配恰好一段
 * - `[...x]` catch-all：匹配一段或多段（且必须是模板最后一段）
 */
function templateMatches(templateSegs: string[], pathSegs: string[]): boolean {
  let ti = 0;
  let pi = 0;
  while (ti < templateSegs.length) {
    const seg = templateSegs[ti];
    if (seg.startsWith('[...')) {
      // catch-all 必须是最后一段，且至少吃掉一段剩余路径
      return ti === templateSegs.length - 1 && pathSegs.length - pi >= 1;
    }
    if (pi >= pathSegs.length) return false;
    if (seg.startsWith('[')) {
      ti += 1;
      pi += 1;
      continue;
    }
    if (seg !== pathSegs[pi]) return false;
    ti += 1;
    pi += 1;
  }
  return pi === pathSegs.length;
}

/** 模板里字面量段的数量，用于在多个模板同时命中时优选更具体的那个。 */
function literalCount(templateSegs: string[]): number {
  return templateSegs.filter((s) => !s.startsWith('[')).length;
}

/**
 * 把一个已剥离 locale 前缀的路径映射到它在 ROUTE_POLICY 中的策略。
 * 无任何模板命中时返回 null（宁可不建议，也不瞎猜）。
 */
export function matchRoutePolicy(pathname: string): Policy | null {
  const pathSegs = segmentsOf(pathname);
  let best: { policy: Policy; specificity: number } | null = null;
  for (const [template, policy] of Object.entries(ROUTE_POLICY)) {
    const templateSegs = segmentsOf(template);
    if (!templateMatches(templateSegs, pathSegs)) continue;
    const specificity = literalCount(templateSegs);
    if (!best || specificity > best.specificity) {
      best = { policy, specificity };
    }
  }
  return best?.policy ?? null;
}
