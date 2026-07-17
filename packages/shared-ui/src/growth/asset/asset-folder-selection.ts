import type { MaterialAsset } from '@autix/shared-store';

/**
 * 一组素材相对各文件夹的归属状态 —— 供「Add to folder」菜单画复选框。
 *
 * 单张和批量共用同一套判定：单张时 assets 长度为 1，「全在该文件夹」自然等价于
 * 「它就在该文件夹」，不需要两套逻辑。
 */
export interface FolderSelectionState {
  /** 选中项**全部**都在该文件夹 → 实心勾。 */
  checked: Set<string>;
  /** 只有**部分**在该文件夹 → 半选（横杠）。混选时画实心勾会是谎。 */
  partial: Set<string>;
}

export function folderSelectionState(assets: MaterialAsset[]): FolderSelectionState {
  const checked = new Set<string>();
  const partial = new Set<string>();
  if (assets.length === 0) return { checked, partial };

  const countByFolder = new Map<string, number>();
  for (const asset of assets) {
    if (!asset.folderId) continue;
    countByFolder.set(asset.folderId, (countByFolder.get(asset.folderId) ?? 0) + 1);
  }

  for (const [folderId, count] of countByFolder) {
    if (count === assets.length) checked.add(folderId);
    else partial.add(folderId);
  }
  return { checked, partial };
}
