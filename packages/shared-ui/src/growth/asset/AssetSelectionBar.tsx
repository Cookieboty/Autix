'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, Loader2, Share2, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialAsset, MaterialFolder } from '@autix/shared-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { ASSET_MENU_PANEL_CLASS } from './CursorMenu';
import { AssetFolderList } from './AssetFolderSubmenu';
import { folderSelectionState } from './asset-folder-selection';

/**
 * 多选操作栏。外观与 /ai/image 历史的选中工具栏对齐（渐变玻璃底 + 缩略图堆叠 +
 * 文字按钮 + 图标按钮）。
 *
 * 「Add to」在这里是**批量**归类：一次把选中的全部素材放进某个文件夹。
 * 复用与右键菜单同一个文件夹列表组件，避免两处的勾选/新建行为漂移。
 */

const TEXT_BUTTON_CLASS =
  'inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground/85 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60';
const ICON_BUTTON_CLASS =
  'grid size-9 place-items-center rounded-xl text-foreground/85 transition hover:bg-white/5 disabled:opacity-40';

export function AssetSelectionBar({
  assets,
  folders,
  publishing,
  pendingFolderId,
  onDownloadAll,
  onPublishAll,
  onAddAllToFolder,
  onRemoveAllFromFolder,
  onCreateFolderWithAll,
  onDeleteAll,
  onClear,
}: {
  assets: MaterialAsset[];
  folders: MaterialFolder[];
  publishing: boolean;
  pendingFolderId: string | null;
  onDownloadAll: () => void;
  onPublishAll: () => void;
  onAddAllToFolder: (folder: MaterialFolder) => void;
  /** 取消勾选：把选中项从该文件夹移出（回到未归类）。 */
  onRemoveAllFromFolder: (folder: MaterialFolder) => void;
  onCreateFolderWithAll: (name: string) => Promise<boolean>;
  onDeleteAll: () => void;
  onClear: () => void;
}) {
  const t = useTranslations('publicGrowth.assets');
  const [addToOpen, setAddToOpen] = useState(false);
  const selection = useMemo(() => folderSelectionState(assets), [assets]);
  /**
   * 缩略图/计数在退场动画期间要保持住：一旦 assets 清空就直接读 props，
   * 工具栏会在下滑淡出的过程中先变成「0 selected、无缩略图」再消失，很难看。
   * 故留一份最后的非空快照专供退场帧使用。
   */
  const lastShown = useRef<MaterialAsset[]>(assets);
  if (assets.length > 0) lastShown.current = assets;
  const shown = assets.length > 0 ? assets : lastShown.current;
  const visible = assets.length > 0;

  return (
    <div
      data-selection-bar=""
      aria-hidden={!visible}
      // 不做条件卸载：卸载了就没有退场动画。用 translate + opacity 从下往上滑入，
      // 隐藏时 pointer-events-none 让它不挡住底下的网格。
      className={`absolute inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <div className="growth-panel-shadow pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(32,34,37,0.88),rgba(24,26,29,0.92))] p-2 backdrop-blur-[32px]">
        <span className="mr-1 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-1.5 text-sm font-bold text-foreground">
          {/* 缩略图堆叠：最多 3 张、扇形微旋，与历史工具栏同一做法。 */}
          <span className="flex items-center">
            {shown.slice(0, 3).map((asset, index, arr) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={asset.id}
                src={asset.thumbnailUrl || asset.url}
                alt=""
                className="size-6 shrink-0 rounded-md border border-white/15 object-cover shadow-md"
                style={{
                  marginLeft: index === 0 ? 0 : -10,
                  transform:
                    arr.length > 1 ? `rotate(${(index - (arr.length - 1) / 2) * 9}deg)` : undefined,
                  zIndex: arr.length - index,
                }}
              />
            ))}
          </span>
          {t('selectedCount', { count: shown.length })}
        </span>

        <button type="button" onClick={onDownloadAll} className={TEXT_BUTTON_CLASS}>
          <Download className="size-4" />
          {t('bulk.download')}
        </button>

        <button
          type="button"
          onClick={onPublishAll}
          disabled={publishing}
          className={TEXT_BUTTON_CLASS}
        >
          {publishing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          {t('bulk.publishAll')}
        </button>

        <DropdownMenu open={addToOpen} onOpenChange={setAddToOpen}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={TEXT_BUTTON_CLASS}>
              <ActionFolderIcon />
              {t('bulk.addTo')}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="center"
            sideOffset={10}
            className={`w-[230px] ${ASSET_MENU_PANEL_CLASS}`}
          >
            <AssetFolderList
              folders={folders}
              // 从选中项真实推导：全部都在 → 实心勾；只有部分在 → 半选横杠。
              checkedFolderIds={selection.checked}
              partialFolderIds={selection.partial}
              pendingFolderId={pendingFolderId}
              onToggleFolder={(folder, next) =>
                next ? onAddAllToFolder(folder) : onRemoveAllFromFolder(folder)
              }
              onCreateFolder={onCreateFolderWithAll}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={onDeleteAll}
          aria-label={t('bulk.delete')}
          className={ICON_BUTTON_CLASS}
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label={t('clearSelection')}
          className={ICON_BUTTON_CLASS}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * 「Add to」按钮的线性文件夹图标——这是**动作**图标，不是某个文件夹的身份，
 * 故不用 FolderGlyph（那个会渲染 emoji）。名字带 Action 前缀以免与之混淆。
 */
function ActionFolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}
