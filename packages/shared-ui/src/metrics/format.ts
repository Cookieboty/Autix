/** 指标数字展示格式化：0 / 999 / 1.2k / 3.4w，避免大数把 metrics bar 撑爆。 */
export function formatMetricCount(value: number | undefined | null): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(Math.round(n));
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w`;
}
