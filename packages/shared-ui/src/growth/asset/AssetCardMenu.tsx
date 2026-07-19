'use client';

import { ArrowUpRight, Download, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialAsset, MaterialFolder } from '@autix/shared-store';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import { ASSET_MENU_ITEM_CLASS, CursorMenu, type CursorMenuState } from './CursorMenu';
import { AssetFolderSubmenu } from './AssetFolderSubmenu';
import { folderSelectionState } from './asset-folder-selection';

/**
 * 素材卡右键菜单：Open / Add to folder / Download / Delete。
 *
 * 关于「Add to folder」的语义：设计稿画的是复选框（一个素材可属于多个文件夹），
 * 但本仓库的数据模型是 material_assets.folderId —— **单个**外键，一个素材只能在一个
 * 文件夹里。所以这里是「移动」而非「多归属」：勾另一个文件夹 = 移过去；
 * 再点当前已勾的那个 = 移出到未归类。真要多归属得加中间表，那是另一档改动。
 *
 * 设计稿里的 Share 未实现：素材没有分享端点（gallery 的分享是针对作品帖的，
 * 不是素材库）。宁可不放，也不放一个点了没反应的入口。
 */
export function AssetCardMenu({
  asset,
  state,
  folders,
  pendingFolderId,
  onOpen,
  onDownload,
  onToggleFolder,
  onCreateFolder,
  onDelete,
  onPublish,
  publishing,
}: {
  asset: MaterialAsset;
  state: CursorMenuState;
  folders: MaterialFolder[];
  pendingFolderId: string | null;
  onOpen: (asset: MaterialAsset) => void;
  onDownload: (asset: MaterialAsset) => void;
  /** next=true 加入该文件夹，false 移出。 */
  onToggleFolder: (asset: MaterialAsset, folder: MaterialFolder, next: boolean) => void;
  onCreateFolder: (asset: MaterialAsset, name: string) => Promise<boolean>;
  onDelete: (asset: MaterialAsset) => void;
  /** 投稿到广场。只对生成素材出现，见下方 canPublish。 */
  onPublish: (asset: MaterialAsset) => void;
  publishing: boolean;
}) {
  const t = useTranslations('publicGrowth.assets');

  /**
   * 只有**生成的**素材能投稿。
   *
   * 用户上传的参考图/视频/音频虽然同样躺在素材库里，但它们不是作品——它们是别处
   * 拿来的素材，发到广场既没有出处也没有生成参数。服务端的 FROM_GENERATION 投稿
   * 本来就要求一条生成记录（asset.sourceId 里那个 generationId），上传素材根本没有，
   * 硬发也只会被拒。所以这里直接不给入口，而不是给了再报错。
   */
  const canPublish = asset.librarySource === 'GENERATION';

  // 与批量工具栏共用同一套判定（单张时「全在该文件夹」= 「它就在该文件夹」）。
  const selection = folderSelectionState([asset]);

  return (
    <CursorMenu state={state} width={190}>
      <DropdownMenuItem
        onClick={() => onOpen(asset)}
        className={`${ASSET_MENU_ITEM_CLASS} text-foreground/85`}
      >
        <ArrowUpRight className="size-3.5 text-foreground/45" />
        {t('card.open')}
      </DropdownMenuItem>

      <AssetFolderSubmenu
        folders={folders}
        checkedFolderIds={selection.checked}
        pendingFolderId={pendingFolderId}
        onToggleFolder={(folder, next) => onToggleFolder(asset, folder, next)}
        onCreateFolder={(name) => onCreateFolder(asset, name)}
      />

      {canPublish ? (
        <DropdownMenuItem
          onClick={() => onPublish(asset)}
          disabled={publishing}
          className={`${ASSET_MENU_ITEM_CLASS} text-foreground/85`}
        >
          <Upload className="size-3.5 text-foreground/45" />
          {t('card.publish')}
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuItem
        onClick={() => onDownload(asset)}
        className={`${ASSET_MENU_ITEM_CLASS} text-foreground/85`}
      >
        <Download className="size-3.5 text-foreground/45" />
        {t('card.download')}
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => onDelete(asset)}
        className={`${ASSET_MENU_ITEM_CLASS} text-destructive`}
      >
        <Trash2 className="size-3.5" />
        {t('card.delete')}
      </DropdownMenuItem>
    </CursorMenu>
  );
}
