'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Expand, Loader2, Shrink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  useAssetCounts,
  useAssetLibraryController,
  useMaterialFolderStore,
  useMaterialStore,
  type AssetBucket,
  type MaterialAsset,
  type MaterialFolder,
} from '@autix/shared-store';
import { useRouter } from '../../navigation';
import type { TemplateDensity } from '../generator/generator-studio-helpers';
import { StudioDensitySlider } from '../generator/parts';
import { AssetSidebar } from './AssetSidebar';
import { AssetGrid, type AssetFitMode } from './AssetGrid';
import { AssetDetailDialog } from './AssetDetailDialog';
import { folderErrorMessage } from './asset-folder-name';
import { AssetSelectionBar } from './AssetSelectionBar';
import { AssetFolderHeading } from './AssetFolderHeading';
import { AssetEmptyState } from './AssetEmptyState';
import { publishAssetsToGallery } from './asset-publish';

/**
 * /asset 页面主体：左侧路由式导航 + 右侧密度滑块与日期分组网格。
 *
 * 各分桶（all/favorites/image/video/folder）是独立路由，都渲染本组件，只是入参不同
 * —— 与旧 /materials「全靠组件内 state」相比，刷新/分享/后退都能回到同一视图。
 */

/** 搜索防抖：输入即请求会把素材库打满。 */
const SEARCH_DEBOUNCE_MS = 300;

export function AssetLibraryView({
  bucket,
  folderId,
}: {
  bucket: AssetBucket;
  /** 文件夹视图专用；给了就在该文件夹内筛。 */
  folderId?: string;
}) {
  const t = useTranslations('publicGrowth.assets');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [density, setDensity] = useState<TemplateDensity>('normal');
  // 默认 contain：方卡内按最长边完整展示，不裁切。滑块左侧的按钮切到 cover（铺满方卡）。
  const [fit, setFit] = useState<AssetFitMode>('contain');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<MaterialAsset | null>(null);
  /** 右键菜单里正在提交的那个文件夹（该行显示转圈）。 */
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(
    () => ({ bucket, folderId, search: search || undefined }),
    [bucket, folderId, search],
  );
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    removeItems,
    patchItem,
  } = useAssetLibraryController(query);

  const deleteMaterials = useMaterialStore((s) => s.deleteMaterials);
  const moveMaterials = useMaterialStore((s) => s.moveMaterials);
  const loadFolders = useMaterialFolderStore((s) => s.loadFolders);
  const createFolder = useMaterialFolderStore((s) => s.createFolder);
  const renameFolder = useMaterialFolderStore((s) => s.renameFolder);
  const deleteFolder = useMaterialFolderStore((s) => s.deleteFolder);
  const setFolderIcon = useMaterialFolderStore((s) => s.setFolderIcon);
  const sidebar = useMaterialFolderStore((s) => s.sidebar);
  const router = useRouter();
  const { counts, refresh: refreshCounts } = useAssetCounts();

  /** 文件夹视图下的当前文件夹（侧栏列表是唯一来源，避免为标题再拉一次接口）。 */
  const currentFolder = useMemo(
    () => (folderId ? sidebar?.folders.find((folder) => folder.id === folderId) ?? null : null),
    [folderId, sidebar?.folders],
  );

  // 切换分桶时清空选择：跨视图保留选中项会让「删除选中」删到看不见的东西。
  useEffect(() => setSelected(new Set()), [bucket, folderId]);

  /** 删除文件夹会连夹内素材一起删（后端行为），列表与角标都要重来。 */
  const handleAssetsInvalidated = useCallback(() => {
    refresh();
    refreshCounts();
  }, [refresh, refreshCounts]);

  const handleDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      removeItems(ids);
      setSelected(new Set());
      setDetail(null);
      try {
        await deleteMaterials(ids);
        // 素材数变了：文件夹 assetCount 与导航角标都要跟上。
        await loadFolders();
        refreshCounts();
      } catch (error) {
        // 删除失败：把乐观摘掉的条目拉回来，并说明原因。
        toast.error(folderErrorMessage(error, t('card.deleteFailed')));
        refresh();
      }
    },
    [deleteMaterials, loadFolders, refresh, refreshCounts, removeItems, t],
  );

  const handleToggleFolder = useCallback(
    async (asset: MaterialAsset, folder: MaterialFolder, next: boolean) => {
      const targetFolderId = next ? folder.id : null;
      setPendingFolderId(folder.id);
      try {
        await moveMaterials([asset.id], targetFolderId);
        // 就地改这一条，**不重拉列表**：勾个文件夹而已，不该把滚动位置和已加载的分页打掉。
        // 但当前正看某个文件夹、而这条被移走时，它已经不属于本视图——就地摘掉，
        // 否则用户会看到一张「明明已经移出去了却还赖在这个文件夹里」的卡。
        if (folderId && targetFolderId !== folderId) removeItems([asset.id]);
        else patchItem(asset.id, { folderId: targetFolderId });
        // 侧栏的 assetCount 确实变了，但它是独立数据源，刷它不影响右侧网格。
        await loadFolders();
      } catch (error) {
        toast.error(folderErrorMessage(error, t('card.moveFailed')));
      } finally {
        setPendingFolderId(null);
      }
    },
    [folderId, loadFolders, moveMaterials, patchItem, removeItems, t],
  );

  /** 返回是否创建成功——菜单里的新建行据此决定收不收起（失败要留在原地重试）。 */
  const handleCreateFolderWith = useCallback(
    async (asset: MaterialAsset, name: string): Promise<boolean> => {
      try {
        // 「建 + 移」两步：建完立刻把这张放进去。
        // 用接口返回的行拿 id，不按名字回查——后端会 trim/截断名称（normalizeName），
        // 回查用的是用户输入的原名，一旦被规范化过就找不到，静默失败。
        const created = await createFolder(name);
        if (!created) return false;
        await moveMaterials([asset.id], created.id);
        patchItem(asset.id, { folderId: created.id });
        await loadFolders();
        return true;
      } catch (error) {
        toast.error(folderErrorMessage(error, t('folder.createFailed')));
        return false;
      }
    },
    [createFolder, loadFolders, moveMaterials, patchItem, t],
  );

  const selectedAssets = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected],
  );

  const handleRenameFolder = useCallback(
    async (folder: MaterialFolder, name: string) => {
      try {
        await renameFolder(folder.id, name);
      } catch (error) {
        toast.error(folderErrorMessage(error, t('folder.renameFailed')));
      }
    },
    [renameFolder, t],
  );

  const handleChangeFolderIcon = useCallback(
    async (folder: MaterialFolder, icon: string | null) => {
      try {
        await setFolderIcon(folder.id, icon);
      } catch (error) {
        toast.error(folderErrorMessage(error, t('icon.failed')));
      }
    },
    [setFolderIcon, t],
  );

  const handleDeleteFolder = useCallback(
    async (folder: MaterialFolder) => {
      // eslint-disable-next-line no-alert
      if (!window.confirm(t('folder.deleteConfirm', { name: folder.name }))) return;
      try {
        await deleteFolder(folder.id);
        // 夹内素材被一并删除（后端行为），且当前视图就是这个夹——回到全部。
        router.replace('/asset/all');
      } catch (error) {
        toast.error(folderErrorMessage(error, t('folder.deleteFailed')));
      }
    },
    [deleteFolder, router, t],
  );

  const handleDownload = useCallback((asset: MaterialAsset) => {
    if (asset.url) window.open(asset.url, '_blank', 'noopener,noreferrer');
  }, []);

  /**
   * 批量归类：把选中的全部素材移到 targetFolderId（null = 移出到未归类）。
   * 加入与移出共用一条路径——转圈锚点始终是被点的那个文件夹行。
   */
  const moveSelectedToFolder = useCallback(
    // 只用到 id：新建返回的是 MaterialFolderRow（还没有 assetCount），
    // 收窄成最小形状以便两处共用。
    async (folder: { id: string }, targetFolderId: string | null) => {
      const ids = selectedAssets.map((asset) => asset.id);
      if (ids.length === 0) return;
      setPendingFolderId(folder.id);
      try {
        await moveMaterials(ids, targetFolderId);
        // 同单张：移出当前文件夹的，就地从本视图摘掉而不是留着。
        if (folderId && targetFolderId !== folderId) removeItems(ids);
        else ids.forEach((id) => patchItem(id, { folderId: targetFolderId }));
        await loadFolders();
      } catch (error) {
        toast.error(folderErrorMessage(error, t('card.moveFailed')));
      } finally {
        setPendingFolderId(null);
      }
    },
    [folderId, loadFolders, moveMaterials, patchItem, removeItems, selectedAssets, t],
  );

  const handleAddAllToFolder = useCallback(
    (folder: MaterialFolder) => void moveSelectedToFolder(folder, folder.id),
    [moveSelectedToFolder],
  );

  const handleRemoveAllFromFolder = useCallback(
    (folder: MaterialFolder) => void moveSelectedToFolder(folder, null),
    [moveSelectedToFolder],
  );

  const handleCreateFolderWithAll = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        const created = await createFolder(name);
        if (!created) return false;
        await moveSelectedToFolder(created, created.id);
        return true;
      } catch (error) {
        toast.error(folderErrorMessage(error, t('folder.createFailed')));
        return false;
      }
    },
    [createFolder, moveSelectedToFolder, t],
  );

  /** 发布选中素材到广场：靠 sourceId 反解 generationId，走 FROM_GENERATION 投稿。 */
  /** 单条投稿（右键菜单）。复用批量那套：一条也走同一个计划器与同一套提示。 */
  const handlePublishOne = useCallback(
    async (asset: MaterialAsset) => {
      setPublishing(true);
      try {
        const { succeeded, failed } = await publishAssetsToGallery([asset]);
        if (succeeded > 0) toast.success(t('bulk.publishOk', { count: succeeded }));
        if (failed > 0) toast.error(t('bulk.publishFailed', { count: failed }));
      } finally {
        setPublishing(false);
      }
    },
    [t],
  );

  const handlePublishAll = useCallback(async () => {
    setPublishing(true);
    try {
      const { succeeded, failed, skipped } = await publishAssetsToGallery(selectedAssets);
      if (succeeded > 0) toast.success(t('bulk.publishOk', { count: succeeded }));
      if (failed > 0) toast.error(t('bulk.publishFailed', { count: failed }));
      // 非生成来源/视频投不了稿，说清楚而不是假装成功。
      if (succeeded === 0 && failed === 0 && skipped > 0) {
        toast.message(t('bulk.publishSkipped', { count: skipped }));
      }
      setSelected(new Set());
    } finally {
      setPublishing(false);
    }
  }, [selectedAssets, t]);

  const menuProps = useMemo(
    () => ({
      folders: sidebar?.folders ?? [],
      pendingFolderId,
      onOpen: setDetail,
      onDownload: handleDownload,
      onToggleFolder: (asset: MaterialAsset, folder: MaterialFolder, next: boolean) =>
        void handleToggleFolder(asset, folder, next),
      onCreateFolder: handleCreateFolderWith,
      onDelete: (asset: MaterialAsset) => void handleDelete([asset.id]),
      onPublish: (asset: MaterialAsset) => void handlePublishOne(asset),
      publishing,
    }),
    [
      handlePublishOne,
      publishing,
      handleCreateFolderWith,
      handleDelete,
      handleDownload,
      handleToggleFolder,
      pendingFolderId,
      sidebar?.folders,
      t,
    ],
  );

  return (
    // 最大宽度与导航内容对齐（导航 contained 态是 mx-auto max-w-[1920px] + px-3/md:px-5，
    // 见 PublicGeneratorAppNav）——侧栏与网格的左右边界因此和导航的 logo/头像同一条竖线上，
    // 不铺满整屏。
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1920px] gap-4 px-3 md:px-5">
      <AssetSidebar
        search={searchInput}
        onSearchChange={setSearchInput}
        counts={counts}
        onAssetsInvalidated={handleAssetsInvalidated}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* 滑块条上下各 16px：上到内容区顶、下到卡片顶。文件夹视图在左侧显示夹名。 */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            {currentFolder && (
              <AssetFolderHeading
                folder={currentFolder}
                onRename={(folder, name) => void handleRenameFolder(folder, name)}
                onDelete={(folder) => void handleDeleteFolder(folder)}
                onChangeIcon={(folder, icon) => void handleChangeFolderIcon(folder, icon)}
              />
            )}
          </div>
          {/* 切换按钮与滑块共用同一个 pill 背景：按钮走 slider 的 leading 插槽，
              而不是在外面另摆一个自带底的按钮（那会是两个 pill）。 */}
          <StudioDensitySlider
            label={t('density')}
            value={density}
            onChange={setDensity}
            leading={
              <button
                type="button"
                onClick={() => setFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
                aria-pressed={fit === 'cover'}
                aria-label={fit === 'contain' ? t('fit.toCover') : t('fit.toContain')}
                title={fit === 'contain' ? t('fit.toCover') : t('fit.toContain')}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-foreground/55 transition hover:bg-white/10 hover:text-foreground"
              >
                {/* 图标表示「点下去会发生什么」：contain 态给外扩（去铺满），cover 态给内收（回到完整展示）。 */}
                {fit === 'contain' ? <Expand className="size-3" /> : <Shrink className="size-3" />}
              </button>
            }
          />
        </div>

        {/* 内容卡：只有上方两角是大圆角，下方直接切到视口底部（不收口、不留边距）；
            滚动条在卡内，页面本身不滚（外层 (public) layout 对 /asset 锁了视口高度）。 */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-[rgba(217,217,217,0.04)] bg-[rgb(19,21,23)] px-4 pb-16 pt-4"
          // 有选中项时点空白处取消选中。只认「没落在任何卡片/工具栏/菜单上」的按下，
          // 否则会把点卡片、点工具栏按钮也当成点空白。框选起手同样是 mousedown，
          // 但它只在移动超过阈值后才生效，两者不冲突。
          onMouseDown={(event) => {
            if (selected.size === 0) return;
            const target = event.target as HTMLElement;
            if (target.closest('[data-asset-card]') || target.closest('[data-selection-bar]')) return;
            setSelected(new Set());
          }}
        >
          {error ? (
            <p className="py-16 text-center text-sm text-foreground/45">{error}</p>
          ) : loading ? (
            // 简单的居中白色转圈——不用骨架屏：切文件夹通常很快，
            // 骨架屏那一下形变反而比转圈更晃眼。
            <div className="grid h-full place-items-center">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          ) : items.length === 0 ? (
            <AssetEmptyState />
          ) : (
            <AssetGrid
              assets={items}
              density={density}
              fit={fit}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onOpen={setDetail}
              selected={selected}
              onSelectedChange={setSelected}
              menuProps={menuProps}
            />
          )}
        </div>

        <AssetSelectionBar
          assets={selectedAssets}
          folders={sidebar?.folders ?? []}
          publishing={publishing}
          pendingFolderId={pendingFolderId}
          onDownloadAll={() => selectedAssets.forEach(handleDownload)}
          onPublishAll={() => void handlePublishAll()}
          onAddAllToFolder={handleAddAllToFolder}
          onRemoveAllFromFolder={handleRemoveAllFromFolder}
          onCreateFolderWithAll={handleCreateFolderWithAll}
          onDeleteAll={() => void handleDelete([...selected])}
          onClear={() => setSelected(new Set())}
        />
      </main>

      <AssetDetailDialog
        asset={detail}
        onClose={() => setDetail(null)}
        onDelete={(asset) => void handleDelete([asset.id])}
      />
    </div>
  );
}
