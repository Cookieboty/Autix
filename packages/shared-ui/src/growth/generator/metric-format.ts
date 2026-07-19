/**
 * 卡片角标上的计数格式化（浏览量 / 点赞数）。
 *
 * image 与 video 两个广场墙共用：同一个数字在两面墙上必须是同一种写法，
 * 各留一份早晚会出现「1.2K」和「1200」并存。
 */
export function formatMetricCount(value?: number | null) {
  const count = Math.max(0, value ?? 0);
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}
