'use client';

import { useEffect, useState, type ComponentType } from 'react';
import {
  ChevronDown,
  Folder,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  useAuthStore,
  useMaterialFolderStore,
  type MaterialCounts,
  type MaterialFolder,
} from '@autix/shared-store';
import { folderErrorMessage, nextFolderName } from './asset-folder-name';
import { ASSET_MENU_ITEM_CLASS, CursorMenu, useCursorMenu } from './CursorMenu';
import { FolderGlyph } from './FolderGlyph';
import { Link, usePathname, useRouter } from '../../navigation';
import { DropdownMenuItem } from '../../ui/dropdown-menu';

/**
 * /asset 左侧导航。
 *
 * 与旧 /materials 的 MaterialFolderSidebar 的关键区别：**选中态由路由决定，不由 store**。
 * 旧库的分桶/文件夹全是组件内 state，刷新即丢；这里每个入口都是真路由，可分享、可回退。
 */

const SIDEBAR_WIDTH = 192;

/** 选中项的抬起底色：与素材方卡同一层表面色，比侧栏底色(15,17,19)高一档。 */
const ACTIVE_SURFACE = 'rgb(28,30,32)';

/**
 * 导航项三态色。与头部全局导航同一套默认色。
 * hover 落在默认与选中之间——比选中的纯白暗一档，让「悬浮」和「已选中」仍能一眼分开。
 */
const NAV_MUTED = '#737475';
const NAV_HOVER = 'rgba(255,255,255,0.72)';
const NAV_ACTIVE = '#ffffff';

type BucketKey = 'all' | 'favorites' | 'uploads' | 'image' | 'video';

const BUCKETS: Array<{ key: BucketKey; icon: ComponentType<{ className?: string }> }> = [
  { key: 'all', icon: Layers },
  { key: 'uploads', icon: Upload },
  { key: 'favorites', icon: Heart },
];

/** 「Type」分组：只有图片与视频。音频暂无生成链路（仓库里没有音频生成表/接口），不列。 */
const TYPES: Array<{ key: Extract<BucketKey, 'image' | 'video'>; icon: ComponentType<{ className?: string }> }> = [
  { key: 'image', icon: ImageIcon },
  { key: 'video', icon: Video },
];

function workspaceName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.realName || user?.username || user?.email?.split('@')[0] || 'My';
}

/** 工作区名字前的小方块：取名字首字，权当迷你头像（设计里那个「建」）。 */
function WorkspaceBadge({ name }: { name: string }) {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded bg-white/[0.06] text-[9px] font-semibold text-foreground/50">
      {[...name][0] ?? '?'}
    </span>
  );
}

/** 行尾计数角标。数字未知（未登录/加载中）时不占位，避免闪一个 0。 */
function CountTip({ value, active }: { value?: number; active?: boolean }) {
  if (value === undefined) return null;
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-px text-[11px] font-medium tabular-nums ${
        active ? 'bg-white/[0.08] text-foreground/75' : 'bg-white/[0.04] text-foreground/35'
      }`}
    >
      {value}
    </span>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  count,
  active,
  /** 文件夹行：图标走 FolderGlyph（emoji 或蓝色实心），且不随选中态变白。 */
  tinted,
  folderIcon,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active: boolean;
  tinted?: boolean;
  folderIcon?: string | null;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-8 items-center gap-2.5 rounded-lg px-2 text-xs transition ${
        active ? 'font-semibold' : 'font-medium hover:bg-white/[0.03]'
      }`}
      style={{
        backgroundColor: active ? ACTIVE_SURFACE : undefined,
        color: active ? NAV_ACTIVE : NAV_MUTED,
      }}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.color = NAV_HOVER;
      }}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.style.color = NAV_MUTED;
      }}
    >
      {/* 图标默认跟随文字色（currentColor），故 hover/选中会一起变；
          文件夹的青色是唯一例外，不随状态走。 */}
      {/* 文件夹图标比系统分桶的略小一档：实心色块在同尺寸下视觉重量明显更沉。
          设了 emoji 的文件夹渲染 emoji —— 与顶部标题共用 FolderGlyph，改一处两处同时变。 */}
      {tinted ? (
        <FolderGlyph icon={folderIcon} className="size-3.5" />
      ) : (
        <Icon className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <CountTip value={count} active={active} />
    </Link>
  );
}

/** 重命名中的文件夹行：就地变输入框，文本预选中，Enter 提交 / Esc 取消 / 失焦提交。 */
function FolderRenameRow({
  folder,
  onCommit,
  onCancel,
}: {
  folder: MaterialFolder;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(folder.name);

  const commit = () => {
    const next = value.trim();
    if (!next || next === folder.name) onCancel();
    else onCommit(next);
  };

  return (
    <div className="flex h-8 items-center gap-2.5 rounded-lg px-2">
      {/* 与非编辑态同一图形与尺寸：编辑期间 emoji 不该消失、图标不该跳大小。 */}
      <FolderGlyph icon={folder.icon} className="size-3.5" />
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        // 进入重命名即全选：直接改名是主要意图，不用先手动圈一遍旧名字。
        onFocus={(event) => event.target.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') onCancel();
        }}
        // 不给输入框任何外观：底色/边框/ring 全不加，行还是原来那一行，
        // 只是文字变得可编辑——加个高亮框反而像是弹出了别的控件。
        className="min-w-0 flex-1 bg-transparent p-0 text-xs font-medium text-foreground outline-none"
      />
    </div>
  );
}

/** 文件夹行：左键进入（普通链接），右键在光标处弹 Rename / Delete。 */
function FolderRow({
  folder,
  active,
  onRename,
  onDelete,
}: {
  folder: MaterialFolder;
  active: boolean;
  onRename: (folder: MaterialFolder) => void;
  onDelete: (folder: MaterialFolder) => void;
}) {
  const t = useTranslations('publicGrowth.assets');
  const menu = useCursorMenu();

  return (
    <div onContextMenu={menu.openAt}>
      <NavRow
        href={`/asset/folder/${folder.id}`}
        icon={Folder}
        label={folder.name}
        count={folder.assetCount}
        active={active}
        tinted
        folderIcon={folder.icon}
      />
      <CursorMenu state={menu} width={168}>
        <DropdownMenuItem
          onClick={() => onRename(folder)}
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

export function AssetSidebar({
  search,
  onSearchChange,
  counts,
  onAssetsInvalidated,
}: {
  search: string;
  onSearchChange: (next: string) => void;
  /** 分桶计数（来自 /api/materials/counts）。文件夹计数走 folder store 自带的 assetCount。 */
  counts: MaterialCounts | null;
  /**
   * **只在文件夹操作真的动了素材时**调用——即删除文件夹（后端 deleteFolder 会把夹内素材
   * 一并删掉，见 FavoriteLibraryService.deleteFolder）。
   *
   * 创建/重命名不碰任何素材，绝不能调：那会把右侧网格整个重拉一遍，
   * 滚动位置和已加载的分页全没了，用户只是建了个文件夹而已。
   * 侧栏自身的文件夹列表由 folder store 的 loadFolders() 自己刷新，不经由这里。
   */
  onAssetsInvalidated?: () => void;
}) {
  const t = useTranslations('publicGrowth.assets');
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sidebar = useMaterialFolderStore((s) => s.sidebar);
  const loadFolders = useMaterialFolderStore((s) => s.loadFolders);
  const createFolder = useMaterialFolderStore((s) => s.createFolder);
  const renameFolder = useMaterialFolderStore((s) => s.renameFolder);
  const deleteFolder = useMaterialFolderStore((s) => s.deleteFolder);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  /** 正在就地重命名的文件夹 id（同一时刻只允许一个）。 */
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    // 同 useAssetLibraryController：/api/material-folders 也是鉴权接口，
    // 未登录发出去会被 SDK 的 401 拦截器弹去 /login。
    if (!hydrated || !isAuthenticated) return;
    void loadFolders().catch(() => {
      // 文件夹拉取失败不该让整个侧栏塌掉：分桶入口与素材网格都不依赖它。
    });
  }, [hydrated, isAuthenticated, loadFolders]);

  const isActive = (href: string) => pathname === href;

  const handleCreateFolder = async () => {
    if (creating) return;
    setCreating(true);
    try {
      // 避开同名：后端对重名是 409 硬拒，固定递 "New folder" 只有第一次能成。
      const name = nextFolderName(
        t('newFolder'),
        (sidebar?.folders ?? []).map((folder) => folder.name),
      );
      // 不通知父级：新建文件夹是空的，右侧素材一条都没变。
      await createFolder(name);
    } catch (error) {
      // 不能吞：吞掉的话「非会员 403 / 重名 409」在界面上就是「点了没反应」。
      toast.error(folderErrorMessage(error, t('folder.createFailed')));
    } finally {
      setCreating(false);
    }
  };

  const handleRenameCommit = async (folder: MaterialFolder, name: string) => {
    setRenamingId(null);
    try {
      // 同 create：改个名字而已，素材没变。
      await renameFolder(folder.id, name);
    } catch (error) {
      toast.error(folderErrorMessage(error, t('folder.renameFailed')));
    }
  };

  const handleDelete = async (folder: MaterialFolder) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('folder.deleteConfirm', { name: folder.name }))) return;
    try {
      await deleteFolder(folder.id);
      // 唯一需要通知父级的分支：后端删文件夹会连夹内素材一起删，右侧列表与角标都已失真。
      onAssetsInvalidated?.();
      // 删的正是当前正在看的那个夹 → 路由已经指向不存在的资源，必须撤离，
      // 否则用户停在一个空白的死 URL 上（刷新也复现）。
      if (pathname === `/asset/folder/${folder.id}`) router.replace('/asset/all');
    } catch (error) {
      toast.error(folderErrorMessage(error, t('folder.deleteFailed')));
    }
  };

  return (
    <aside
      className="flex h-full shrink-0 flex-col gap-4 overflow-y-auto py-4"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground/35" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('searchPlaceholder')}
          // 聚焦不加描边：底色已经把输入框和背景分开了，再套一圈强调色只是噪音。
          className="h-9 w-full rounded-lg bg-secondary pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-foreground/35"
        />
      </div>

      <nav className="flex flex-col gap-1">
        {BUCKETS.map((item) => (
          <NavRow
            key={item.key}
            href={`/asset/${item.key}`}
            icon={item.icon}
            label={t(`bucket.${item.key}`)}
            count={counts?.[item.key]}
            active={isActive(`/asset/${item.key}`)}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <p className="px-2 pb-0.5 text-[11px] font-medium" style={{ color: NAV_MUTED }}>
          {t('type')}
        </p>
        {TYPES.map((item) => (
          <NavRow
            key={item.key}
            href={`/asset/${item.key}`}
            icon={item.icon}
            label={t(`bucket.${item.key}`)}
            count={counts?.[item.key]}
            active={isActive(`/asset/${item.key}`)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex h-6 items-center gap-1.5 px-1">
          <button
            type="button"
            onClick={() => setFoldersOpen((prev) => !prev)}
            aria-expanded={foldersOpen}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium transition"
            style={{ color: NAV_MUTED }}
          >
            <ChevronDown
              className={`size-3.5 shrink-0 text-foreground/35 transition-transform ${foldersOpen ? '' : '-rotate-90'}`}
            />
            <WorkspaceBadge name={workspaceName(user)} />
            <span className="truncate">{workspaceName(user)}</span>
          </button>
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={creating}
            aria-label={t('newFolder')}
            aria-busy={creating}
            className="grid size-5 shrink-0 place-items-center rounded text-foreground/40 transition hover:bg-secondary hover:text-foreground disabled:hover:bg-transparent"
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
          </button>
        </div>

        {foldersOpen &&
          sidebar?.folders.map((folder) =>
            renamingId === folder.id ? (
              <FolderRenameRow
                key={folder.id}
                folder={folder}
                onCommit={(name) => void handleRenameCommit(folder, name)}
                onCancel={() => setRenamingId(null)}
              />
            ) : (
              <FolderRow
                key={folder.id}
                folder={folder}
                active={isActive(`/asset/folder/${folder.id}`)}
                onRename={(target) => setRenamingId(target.id)}
                onDelete={handleDelete}
              />
            ),
          )}
      </div>
    </aside>
  );
}
