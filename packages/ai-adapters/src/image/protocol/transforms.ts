import type { TransformKey } from './types';

/**
 * 值变换白名单。**新增变换必须同时在 types.ts 的 TransformKey 与这里登记** ——
 * 这个 Record<TransformKey, …> 标注是故意承重的：往 union 里加一个值，tsc 就会
 * 逼你立刻实现它。取值合法性由跨配置校验器规则 4 兜底（Task 7）。
 */
export const TRANSFORMS: Record<TransformKey, (value: unknown) => unknown> = {
  /**
   * '2048x2048@2K' → '2048x2048'（无损：WxH 已编码分辨率，@tier 只服务计价派生，
   * 上游不需要它 —— spec §7.3）。非字符串原样返回。
   */
  stripTierSuffix: (value) => (typeof value === 'string' ? value.split('@')[0] : value),
};
