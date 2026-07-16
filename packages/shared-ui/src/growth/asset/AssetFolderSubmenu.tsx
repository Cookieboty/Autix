'use client';

import { useState } from 'react';
import { Check, Folder, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialFolder } from '@autix/shared-store';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../../ui/dropdown-menu';
import { ASSET_MENU_ITEM_CLASS, ASSET_MENU_PANEL_CLASS } from './CursorMenu';
import { FolderGlyph } from './FolderGlyph';

/**
 * 「Add to folder」二级菜单。
 *
 * 全程不关菜单：勾选、取消、新建文件夹都要留在原地，只有点菜单外才收起。
 * 因此每个可点项都 onSelect={e => e.preventDefault()} —— Radix 的默认行为是
 * 选中即关闭，不拦的话勾一个文件夹菜单就没了，勾不了第二个。
 *
 * 这里刻意不用 DropdownMenuCheckboxItem：它的勾选标记固定在左侧，而设计要的是
 * 左图标 / 中间名字+数量 / 右复选框。自己排版更直接。
 */

function FolderCheckRow({
  folder,
  checked,
  partial,
  pending,
  onToggle,
}: {
  folder: MaterialFolder;
  checked: boolean;
  /** 只有部分选中项在该文件夹——画横杠而不是勾。 */
  partial: boolean;
  pending: boolean;
  onToggle: (folder: MaterialFolder, next: boolean) => void;
}) {
  const t = useTranslations('publicGrowth.assets');

  return (
    <DropdownMenuItem
      // 勾选后菜单必须留着，否则多选无从谈起。
      onSelect={(event) => event.preventDefault()}
      // 半选时点击视作「补齐」——把还没进去的也放进去，而不是把已进去的挪出来。
      onClick={() => onToggle(folder, !checked)}
      className={`${ASSET_MENU_ITEM_CLASS} font-normal`}
    >
      {/* 与侧栏/标题同源：设了 emoji 就显示 emoji，三处不能各画各的。 */}
      <FolderGlyph icon={folder.icon} className="size-4" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] text-foreground/85">{folder.name}</span>
        <span className="text-[11px] text-foreground/35">
          {t('card.folderAssets', { count: folder.assetCount })}
        </span>
      </span>
      {/* 提交中用转圈代替勾选框。
          这里的勾选框走**主色**——与素材库网格里那些白色勾选框刻意区分：
          网格里白色是为了压在图片上仍清晰，而下拉是纯色面板，主色才是这里的选中语义。 */}
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-foreground/40" />
      ) : (
        <span
          className={`grid size-[18px] shrink-0 place-items-center rounded-[7px] border transition ${
            checked || partial
              ? 'border-growth-accent bg-growth-accent text-background'
              : 'border-white/40 text-transparent'
          }`}
        >
          {partial ? (
            <Minus className="size-3" strokeWidth={3} />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
        </span>
      )}
    </DropdownMenuItem>
  );
}

/**
 * 内联新建：图标 + 输入框 + Save，作为 Private folders 列表的**第一行**。
 *
 * 只有保存成功才收起并让真文件夹进列表 —— 不做乐观插入：失败时列表里留一个
 * 其实不存在的文件夹，比多等一会儿糟得多。saving 是本行自己的状态，
 * 因为收起时机取决于这次请求的结果。
 */
function CreateFolderRow({ onSave }: { onSave: (name: string) => Promise<boolean> }) {
  const t = useTranslations('publicGrowth.assets');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const name = value.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      // 失败则保持这一行在原地（连同已输入的名字），让用户改名重试。
      await onSave(name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex min-h-9 items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5"
      // 输入框在菜单里：不拦的话按键会被 Radix 的排版导航（typeahead / 方向键）吃掉。
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') void submit();
      }}
    >
      {/* 新建行还没有文件夹、自然没有 emoji，走默认图形。 */}
      <FolderGlyph className="size-4" />
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('newFolder')}
        disabled={saving}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground/35"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || !value.trim()}
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-growth-accent/20 px-2 text-[11px] font-bold text-growth-accent transition hover:bg-growth-accent/30 disabled:opacity-40"
      >
        {saving && <Loader2 className="size-3 animate-spin" />}
        {t('card.save')}
      </button>
    </div>
  );
}

/**
 * 文件夹列表本体（含内联新建行）。右键二级菜单与底部批量工具栏共用 —— 两处若各写一份，
 * 勾选/新建的行为迟早漂移。
 */
export function AssetFolderList({
  folders,
  checkedFolderIds,
  partialFolderIds,
  pendingFolderId,
  onToggleFolder,
  onCreateFolder,
}: {
  folders: MaterialFolder[];
  /** 选中项**全部**都在其中的文件夹。 */
  checkedFolderIds: Set<string>;
  /** 只有部分选中项在其中的文件夹（批量时才可能非空）。 */
  partialFolderIds?: Set<string>;
  /** 正在提交的那个文件夹（转圈代替复选框）。 */
  pendingFolderId: string | null;
  onToggleFolder: (folder: MaterialFolder, next: boolean) => void;
  /** 建成返回 true；失败返回 false，新建行保持在原地供用户改名重试。 */
  onCreateFolder: (name: string) => Promise<boolean>;
}) {
  const t = useTranslations('publicGrowth.assets');
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      {(folders.length > 0 || createOpen) && (
        <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-medium text-foreground/35">
          {t('card.privateFolders')}
        </DropdownMenuLabel>
      )}

      <div className="max-h-[260px] overflow-y-auto">
        {/* 新建行在 Private folders **之内**、列表顶部——它就是将要出现在这里的那个文件夹。 */}
        {createOpen && (
          <CreateFolderRow
            onSave={async (name) => {
              const ok = await onCreateFolder(name);
              // 只有真的建成了才收起：没保存 = 没创建。
              if (ok) setCreateOpen(false);
              return ok;
            }}
          />
        )}
        {folders.map((folder) => (
          <FolderCheckRow
            key={folder.id}
            folder={folder}
            checked={checkedFolderIds.has(folder.id)}
            partial={partialFolderIds?.has(folder.id) ?? false}
            pending={pendingFolderId === folder.id}
            onToggle={onToggleFolder}
          />
        ))}
      </div>

      {folders.length > 0 && <DropdownMenuSeparator className="mx-2 my-1 bg-border" />}
      <DropdownMenuItem
        onSelect={(event) => event.preventDefault()}
        onClick={() => setCreateOpen(true)}
        className={`${ASSET_MENU_ITEM_CLASS} text-foreground/85`}
      >
        <Plus className="size-3.5 text-foreground/45" />
        {t('card.createFolder')}
      </DropdownMenuItem>
    </>
  );
}

/** 右键菜单里的「Add to folder」二级入口，内容即 AssetFolderList。 */
export function AssetFolderSubmenu(props: {
  folders: MaterialFolder[];
  checkedFolderIds: Set<string>;
  partialFolderIds?: Set<string>;
  pendingFolderId: string | null;
  onToggleFolder: (folder: MaterialFolder, next: boolean) => void;
  onCreateFolder: (name: string) => Promise<boolean>;
}) {
  const t = useTranslations('publicGrowth.assets');
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={`${ASSET_MENU_ITEM_CLASS} text-foreground/85 data-[state=open]:bg-white/[0.08]`}>
        <Folder className="size-3.5 text-foreground/45" />
        {t('card.addToFolder')}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className={`w-[230px] ${ASSET_MENU_PANEL_CLASS}`}>
          <AssetFolderList {...props} />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
