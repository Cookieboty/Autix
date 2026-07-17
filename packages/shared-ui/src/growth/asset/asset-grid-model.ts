import type { MaterialAsset } from '@autix/shared-store';

/**
 * /asset 网格的纯数据整形：按日期切段 + 选择集运算。抽成无 React 的模块以便直接测。
 *
 * 网格是等大正方形卡片，不需要比例/行打包那套（与 /ai/image 历史的 justified 行不同）——
 * 列数交给 CSS grid auto-fill，这里只管分组。
 */

export interface AssetDateGroup {
  /** 该组的日期键（YYYY-MM-DD，按用户本地时区切分）。 */
  key: string;
  assets: MaterialAsset[];
}

/**
 * 按本地日期分组。刻意用本地时区而不是 UTC 切分：分组标题给人看，
 * 用 UTC 会让深夜生成的素材落到"明天"那一组。
 */
export function assetDateKey(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * 分组并保序：素材列表本身按 createdAt desc 从后端来，这里只做切段，不重排，
 * 否则会和「继续翻页追加」的顺序打架。
 */
export function groupAssetsByDate(assets: MaterialAsset[]): AssetDateGroup[] {
  const groups: AssetDateGroup[] = [];
  let current: AssetDateGroup | null = null;

  for (const asset of assets) {
    const key = assetDateKey(asset.createdAt);
    if (!current || current.key !== key) {
      current = { key, assets: [] };
      groups.push(current);
    }
    current.assets.push(asset);
  }

  return groups;
}

/** 组内全选/全不选的下一个选择集。 */
export function toggleGroupSelection(
  selected: Set<string>,
  group: AssetDateGroup,
): Set<string> {
  const ids = group.assets.map((asset) => asset.id);
  const allSelected = ids.every((id) => selected.has(id));
  const next = new Set(selected);
  for (const id of ids) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}
