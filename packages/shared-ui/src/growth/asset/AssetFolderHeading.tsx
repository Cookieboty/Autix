'use client';

import { useState } from 'react';
import { Ellipsis, Folder, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialFolder } from '@autix/shared-store';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import { ASSET_MENU_ITEM_CLASS, CursorMenu, useCursorMenu } from './CursorMenu';
import { EmojiPicker } from './EmojiPicker';
import { FolderGlyph } from './FolderGlyph';

/**
 * 文件夹视图的标题：点标题即就地改名，右侧「更多」弹出与侧栏文件夹右键同一组菜单。
 *
 * 菜单项与侧栏保持同源语义（Rename / Delete）；Rename 在这里直接进入本组件的
 * 输入态，而不是再跳去侧栏那一行编辑——用户点的是这个标题。
 */
export function AssetFolderHeading({
  folder,
  onRename,
  onDelete,
  onChangeIcon,
}: {
  folder: MaterialFolder;
  /** 提交新名字；失败由调用方 toast，这里只负责退出编辑态。 */
  onRename: (folder: MaterialFolder, name: string) => void;
  onDelete: (folder: MaterialFolder) => void;
  /** null = 清除图标，回到默认文件夹图形。 */
  onChangeIcon: (folder: MaterialFolder, icon: string | null) => void;
}) {
  const t = useTranslations('publicGrowth.assets');
  const menu = useCursorMenu();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(folder.name);

  const commit = () => {
    const next = value.trim();
    setEditing(false);
    if (!next || next === folder.name) {
      setValue(folder.name);
      return;
    }
    onRename(folder, next);
  };

  const iconButton = (
    <button
      type="button"
      aria-label={t('icon.change')}
      className="grid size-7 shrink-0 place-items-center rounded-md transition hover:bg-white/[0.06]"
    >
      <FolderGlyph icon={folder.icon} className="size-[18px]" />
    </button>
  );

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <EmojiPicker
          trigger={iconButton}
          onPick={(emoji) => onChangeIcon(folder, emoji)}
          onClear={() => onChangeIcon(folder, null)}
        />
        <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        // 失焦即保存（与侧栏就地改名一致）；Esc 放弃。
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setValue(folder.name);
            setEditing(false);
          }
        }}
        // 同侧栏：不给输入框外观，标题原地可编辑即可。px-1 与非编辑态的按钮内边距一致，
        // 保证进出编辑态时文字不跳位。
        className="min-w-0 max-w-[320px] bg-transparent px-1 text-lg font-bold text-foreground outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <EmojiPicker
        trigger={iconButton}
        onPick={(emoji) => onChangeIcon(folder, emoji)}
        onClear={() => onChangeIcon(folder, null)}
      />
      <button
        type="button"
        onClick={() => {
          setValue(folder.name);
          setEditing(true);
        }}
        className="min-w-0 truncate rounded-md px-1 text-lg font-bold text-foreground transition hover:bg-white/[0.06]"
      >
        {folder.name}
      </button>
      <button
        type="button"
        aria-label={t('card.more')}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          menu.openAt({ preventDefault: () => {}, clientX: rect.left, clientY: rect.bottom + 4 });
        }}
        className="grid size-6 shrink-0 place-items-center rounded-md text-foreground/45 transition hover:bg-white/[0.06] hover:text-foreground"
      >
        <Ellipsis className="size-4" />
      </button>

      <CursorMenu state={menu} width={168}>
        <DropdownMenuItem
          onClick={() => {
            setValue(folder.name);
            setEditing(true);
          }}
          className={`${ASSET_MENU_ITEM_CLASS} text-foreground/85`}
        >
          <Pencil className="size-3.5 text-foreground/45" />
          {t('folder.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(folder)}
          className={`${ASSET_MENU_ITEM_CLASS} text-destructive`}
        >
          <Trash2 className="size-3.5" />
          {t('folder.delete')}
        </DropdownMenuItem>
      </CursorMenu>
    </div>
  );
}
