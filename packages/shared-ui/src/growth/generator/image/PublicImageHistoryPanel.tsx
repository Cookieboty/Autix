'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Ellipsis, Eye, ImageIcon, RefreshCw, Share2, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { galleryActions, galleryErrorMessage, publicGeneratorActions } from '@autix/shared-store';
import type {
  PublicImageHistoryImage,
  PublicImageHistoryItem,
} from './public-image-generation';
import type { TemplateDensity } from '../generator-studio-helpers';
import { publishSelectionsToGallery, type PublishSelection } from './publish-to-gallery';
import { naturalAspectRatio, resolveSettingsAspectRatio } from './image-aspect';
import { downloadImageFile } from './image-history-media';
import { dedupeGenerationIds, galleryPostActions, summarizeSettled } from './gallery-interaction-model';
import { DeleteGenerationsDialog } from './DeleteGenerationsDialog';
import { PublicImageDetailDialog } from './PublicImageDetailDialog';
import { ImageActionMenu } from './ImageActionMenu';
import { buildImageActionMenuItems } from './image-action-items';
import { resolveGalleryShareUrl } from './gallery-share-link';
import { useLocalizePath } from '../../../navigation';
import { buildJustifiedRows, useElementWidth } from '../justified-rows';

export type PendingImageGenerationCard = {
  id: string;
  prompt: string;
  model: string;
  count: number;
  /**
   * 本次生成提交的 schema 参数包。占位块据此解析比例渲染 —— 传整个 bag 而不是
   * 单个 size 串，因为比例参数的键名逐模型不同（aspectRatio / size），
   * 见 resolveSettingsAspectRatio。
   */
  settings?: Record<string, unknown>;
};

// 历史 Tab：横向 justified 行布局；行高由密度档位决定（档位越密行越矮），滑块调整行高
const HISTORY_ROW_HEIGHT: Record<TemplateDensity, number> = {
  xrelaxed: 700,
  relaxed: 560,
  normal: 440,
  dense: 340,
  xdense: 260,
};

function imageKey(itemId: string, image: PublicImageHistoryImage): string {
  return `${itemId}::${image.generationId ?? ''}::${image.index}`;
}

/**
 * 历史骨架屏：形状照着 justified 行布局来（几行、每行几块、宽度按常见比例参差），
 * 这样数据到位时是「骨架就地变成图」，不是整块重排。
 *
 * 比例不用随机数——SSR 与客户端要算出同一套宽度，否则水合不一致。
 */
const HISTORY_SKELETON_ROWS = [
  [0.75, 1.5, 0.66],
  [1.33, 0.66, 1],
  [1, 0.75, 1.77],
];

function HistorySkeleton({ targetHeight }: { targetHeight: number }) {
  return (
    <div className="flex flex-col gap-[3px]" aria-busy="true">
      {HISTORY_SKELETON_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-[3px]">
          {row.map((ratio, cellIndex) => (
            <div
              key={cellIndex}
              className={`growth-skeleton growth-skeleton-delay-${(rowIndex + cellIndex) % 4} min-w-0`}
              style={{ flexGrow: ratio, flexBasis: 0, height: targetHeight }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PublicImageHistoryPanel({
  items,
  loading,
  density,
  pendingGenerations = [],
  onRecreate,
  onUseAsReference,
  onSelectionActiveChange,
  onHistoryChanged,
}: {
  items: PublicImageHistoryItem[];
  loading: boolean;
  density: TemplateDensity;
  pendingGenerations?: PendingImageGenerationCard[];
  /** 点击某张图的 Recreate：把该次生成的 prompt 应用到输入框 */
  onRecreate?: (item: PublicImageHistoryItem) => void;
  /** 详情弹窗里的 Reference：把该图塞回输入框当参考图 */
  onUseAsReference?: (image: PublicImageHistoryImage) => void;
  /** 是否处于多选态：父级据此切换「输入框 ↔ 操作栏」 */
  onSelectionActiveChange?: (active: boolean) => void;
  /** 发布/删除成功后请求父级重拉 history（徽章状态来自服务端，不靠本地内存猜）。 */
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const locale = useLocale();
  const localize = useLocalizePath();
  const [selectedItem, setSelectedItem] = useState<PublicImageHistoryItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** 投稿请求进行中：期间不接受重复的发布点击（发布已无确认弹窗兜着，点两下就是两条帖）。 */
  const [publishing, setPublishing] = useState(false);
  /** 悬浮菜单里「删除图片」选中的那一条（与多选删除共用确认框，只是 count 恒为 1）。 */
  const [singleDeleteItem, setSingleDeleteItem] = useState<PublicImageHistoryItem | null>(null);
  /**
   * 最后看过的那张图（imageKey）。关掉详情后该格盖一层「Last viewed」遮罩 —— 历史很长时
   * 用户回到列表能一眼找回刚才看的位置。详情里切换多图候选也会更新它。
   */
  const [lastViewedKey, setLastViewedKey] = useState<string | null>(null);

  const openDetail = (item: PublicImageHistoryItem, key: string) => {
    setSelectedItem(item);
    setLastViewedKey(key);
  };
  /** 正在跑帖级动作的那条生成 —— 菜单项据此禁用，避免连点。 */
  const [postingItemId, setPostingItemId] = useState<string | null>(null);
  const { ref: containerRef, width: containerWidth } = useElementWidth<HTMLDivElement>();
  /**
   * 图片加载完成后按 naturalWidth/naturalHeight 校正出的真实比例（key 同 imageKey）。
   * 加载前用 settings 的比例占位，加载后以图片自身为准 —— 厂商实际返回的尺寸未必
   * 等于请求值。
   */
  const [naturalRatios, setNaturalRatios] = useState<Record<string, number>>({});
  // 图片解码完成前该格保持骨架（与 GeneratingCell 同款），解码后再淡入 —— 否则骨架卡
  // 一撤，图片格会先露出灰底再突然出图，产生「骨架消失→空窗→出图」的闪烁。
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());

  const rememberNaturalRatio = (key: string, element: HTMLImageElement) => {
    setLoadedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const ratio = naturalAspectRatio(element);
    if (ratio === undefined) return;
    setNaturalRatios((prev) => (prev[key] === ratio ? prev : { ...prev, [key]: ratio }));
  };

  const selectionActive = selectedKeys.size > 0;
  useEffect(() => {
    onSelectionActiveChange?.(selectionActive);
  }, [selectionActive, onSelectionActiveChange]);
  useEffect(() => () => onSelectionActiveChange?.(false), [onSelectionActiveChange]);

  const toggleKey = (setter: typeof setSelectedKeys, key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // 加载中：骨架屏（形状照着 justified 行来），不是一行「加载中」文字。
  // 注意顺序——先判加载态，确认没数据了才允许渲染空状态，否则刷新时会先闪一下「暂无记录」。
  if (loading && items.length === 0 && pendingGenerations.length === 0) {
    return <HistorySkeleton targetHeight={HISTORY_ROW_HEIGHT[density]} />;
  }

  if (items.length === 0 && pendingGenerations.length === 0) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-border bg-secondary/60 text-foreground/40">
            <ImageIcon className="size-7" />
          </div>
          <h2 className="mt-5 text-lg font-black">{t('emptyHistory')}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-foreground/45">
            {t('imageBlankDescription')}
          </p>
        </div>
      </div>
    );
  }

  const targetHeight = HISTORY_ROW_HEIGHT[density];

  type HistoryCell =
    | { kind: 'pending'; ratio: number; showLabel: boolean; key: string }
    | {
        kind: 'image';
        ratio: number;
        item: PublicImageHistoryItem;
        image: PublicImageHistoryImage;
        key: string;
      };

  // 生成中占位块 push 到最上方（count 个），随后展开所有历史图片；每格带真实比例
  const cells: HistoryCell[] = [
    ...pendingGenerations.flatMap((card) => {
      const ratio = resolveSettingsAspectRatio(card.settings);
      return Array.from({ length: Math.max(1, card.count) }).map((_, index) => ({
        kind: 'pending' as const,
        ratio,
        showLabel: index === 0,
        key: `pending-${card.id}-${index}`,
      }));
    }),
    ...items.flatMap((item) =>
      item.images.map((image) => {
        const key = imageKey(item.id, image);
        return {
          kind: 'image' as const,
          // 加载完成的图以真实比例为准，未加载的先按本次生成选择的比例占位
          ratio: naturalRatios[key] ?? resolveSettingsAspectRatio(item.settings),
          item,
          image,
          key,
        };
      }),
    ),
  ];

  const rows = buildJustifiedRows(cells, containerWidth, targetHeight);
  const selectedImageList = items.flatMap((item) =>
    item.images
      .filter((image) => selectedKeys.has(imageKey(item.id, image)))
      .map((image) => ({ item, image })),
  );

  const downloadSelected = () =>
    selectedImageList.forEach(({ image }, index) =>
      void downloadImageFile(image.url, `image-${index + 1}.png`),
    );
  const clearSelection = () => setSelectedKeys(new Set());

  /**
   * 一键发布（多选工具条 / 单图悬浮菜单共用）：不再弹分类+参考图选择框，直接投稿。
   * 参考图随帖公开，分类留空由审核员补——见 publish-to-gallery。
   */
  const publishNow = async (selections: PublishSelection[]) => {
    if (selections.length === 0 || publishing) return;
    setPublishing(true);
    try {
      const { succeeded, failed, firstError } = await publishSelectionsToGallery(selections);
      if (succeeded === 0) {
        toast.error(galleryErrorMessage(firstError));
        return;
      }
      if (failed === 0) toast.success(t('publishSubmittedToast', { count: succeeded }));
      else toast.warning(t('publishPartialFailedToast', { succeeded, failed }));
      clearSelection();
      onHistoryChanged?.();
    } finally {
      setPublishing(false);
    }
  };

  const selectedGenerationIds = dedupeGenerationIds(selectedImageList);
  /** 选中的这些生成记录，实际会被删掉的图片总数（含未被勾选的兄弟图）——确认框如实展示。 */
  const affectedImageCount = items
    .filter((item) => selectedGenerationIds.includes(item.id))
    .reduce((sum, item) => sum + item.images.length, 0);
  /** 只要选中项里有任何一条还挂着活帖，就不能删（服务端会 409）。 */
  const deletableSelection = items
    .filter((item) => selectedGenerationIds.includes(item.id))
    .every((item) => galleryPostActions(item.galleryPost?.status).canDeleteGeneration);

  const requestDelete = () => {
    if (selectedGenerationIds.length === 0) return;
    if (!deletableSelection) {
      toast.error(t('deleteBlockedToast'));
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const results = await Promise.allSettled(
      selectedGenerationIds.map((id) => publicGeneratorActions.deleteImageHistory(id)),
    );
    const { succeeded, failed } = summarizeSettled(results);
    setDeleting(false);
    setDeleteDialogOpen(false);

    if (succeeded > 0 && failed === 0) toast.success(t('deletedToast', { count: succeeded }));
    else if (succeeded > 0) toast.warning(t('deletePartialFailedToast', { succeeded, failed }));
    else toast.error(t('deleteBlockedToast'));

    clearSelection();
    onHistoryChanged?.();
  };

  /**
   * 悬浮菜单里的帖级动作。出边由 galleryPostActions 按后端状态机给（见详情弹窗同名
   * 函数的注释），这里只负责发请求 + 重拉历史。
   */
  const runPostAction = async (
    item: PublicImageHistoryItem,
    action: 'withdraw' | 'unpublish' | 'republish' | 'removePost',
  ) => {
    const post = item.galleryPost;
    if (!post || postingItemId) return;
    setPostingItemId(item.id);
    try {
      if (action === 'withdraw' || action === 'removePost') await galleryActions.remove(post.id);
      else if (action === 'unpublish') await galleryActions.unpublish(post.id);
      else await galleryActions.republish(post.id);
      toast.success(t('postActionDoneToast'));
      onHistoryChanged?.();
    } catch (err) {
      toast.error(galleryErrorMessage(err));
    } finally {
      setPostingItemId(null);
    }
  };

  /** 悬浮菜单里的「删除图片」：删的是该图所属的整条生成记录（与多选删除同一语义）。 */
  const confirmSingleDelete = async () => {
    if (!singleDeleteItem) return;
    setDeleting(true);
    try {
      await publicGeneratorActions.deleteImageHistory(singleDeleteItem.id);
      toast.success(t('deletedToast', { count: 1 }));
      onHistoryChanged?.();
    } catch {
      toast.error(t('deleteBlockedToast'));
    } finally {
      setDeleting(false);
      setSingleDeleteItem(null);
    }
  };

  return (
    <>
      <div ref={containerRef} className="flex flex-col gap-[3px]">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-[3px]">
            {row.cells.map((cell) => {
              const width = row.height * cell.ratio;
              if (cell.kind === 'pending') {
                return (
                  <GeneratingCell
                    key={cell.key}
                    width={width}
                    height={row.height}
                    showLabel={cell.showLabel}
                  />
                );
              }
              const { item, image, key } = cell;
              const selected = selectedKeys.has(key);
              const loaded = loadedKeys.has(key);
              return (
                <div
                  key={key}
                  className={`group relative min-w-0 overflow-hidden border-solid border-white bg-secondary transition-all duration-75 ${selected ? 'border-[3px]' : 'border-0'}`}
                  style={{ width, height: row.height }}
                >
                  {!loaded ? (
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-0 growth-history-empty-bg" />
                      <div className="growth-scan absolute inset-x-0 top-0 h-24 opacity-30" />
                    </div>
                  ) : null}
                  <img
                    src={image.url}
                    alt={image.prompt ?? item.prompt}
                    loading="lazy"
                    className="relative h-full w-full object-cover transition-opacity duration-300"
                    style={{ opacity: loaded ? 1 : 0 }}
                    // 命中缓存的图不会触发 onLoad（挂载时已 complete），两条路都要读
                    ref={(element) => {
                      if (element?.complete) rememberNaturalRatio(key, element);
                    }}
                    onLoad={(event) => rememberNaturalRatio(key, event.currentTarget)}
                  />
                  {/* 最后查看过的那张：暗色遮罩 + 标记。z-20 低于悬浮操作按钮(z-30)，
                      pointer-events-none 让点击/悬浮照常穿透到下面的按钮上 */}
                  {lastViewedKey === key ? (
                    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/55">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90">
                        <Eye className="size-4" />
                        {t('lastViewed')}
                      </span>
                    </div>
                  ) : null}
                  {/* 点击：多选态下切换选中，否则打开详情 */}
                  <button
                    type="button"
                    aria-label={image.prompt ?? item.prompt}
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={() => (selectionActive ? toggleKey(setSelectedKeys, key) : openDetail(item, key))}
                  />
                  {/* 悬浮效果：仅非多选态展示大内阴影 + 右侧功能图标 */}
                  {!selectionActive ? (
                    <>
                      <div className="pointer-events-none absolute inset-0 z-10 opacity-0 shadow-[inset_0_0_130px_44px_rgba(0,0,0,0.8)] transition duration-200 group-hover:opacity-100" />
                      <div className="absolute right-2 top-2 z-30 flex flex-col gap-1 opacity-0 transition duration-200 group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={t('ariaDownload')}
                          onClick={(event) => {
                            event.stopPropagation();
                            void downloadImageFile(image.url, `image-${image.index + 1}.png`);
                          }}
                          className="grid size-8 place-items-center rounded-full bg-background/55 text-foreground backdrop-blur-md transition hover:bg-background/85"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('recreate')}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRecreate?.(item);
                          }}
                          className="grid size-8 place-items-center rounded-full bg-background/55 text-foreground backdrop-blur-md transition hover:bg-background/85"
                        >
                          <RefreshCw className="size-4" />
                        </button>
                        {/* 更多：与详情弹窗共用同一套菜单项构造。悬浮态是唯一入口，所以全量展开 */}
                        <ImageActionMenu
                          align="end"
                          items={buildImageActionMenuItems({
                            t,
                            image,
                            actions: galleryPostActions(item.galleryPost?.status),
                            posting: postingItemId === item.id,
                            deletable: galleryPostActions(item.galleryPost?.status).canDeleteGeneration,
                            runPostAction: (action) => void runPostAction(item, action),
                            onDelete: () => setSingleDeleteItem(item),
                            onOpen: () => openDetail(item, key),
                            onRecreate: () => onRecreate?.(item),
                            onUseAsReference,
                            onPublish: () => void publishNow([{ item, image }]),
                            // 站内作品分享链接：只有已发布的作品才有（未发布的别人打不开）
                            shareUrl: resolveGalleryShareUrl(item.galleryPost, localize),
                          })}
                          trigger={
                            <button
                              type="button"
                              aria-label={t('more')}
                              onClick={(event) => event.stopPropagation()}
                              className="grid size-8 cursor-pointer place-items-center rounded-full bg-background/55 text-foreground backdrop-blur-md transition hover:bg-background/85"
                            >
                              <Ellipsis className="size-4" />
                            </button>
                          }
                        />
                      </div>
                    </>
                  ) : null}
                  {/* 左上复选框：多选态下全部常显（未选为淡色）；否则悬浮出现。较小、小圆角 */}
                  <button
                    type="button"
                    aria-label={t('ariaSelect')}
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleKey(setSelectedKeys, key);
                    }}
                    className={`absolute left-2 top-2 z-30 grid size-[18px] place-items-center rounded-[7px] border transition ${
                      selected
                        ? 'border-white bg-white text-background opacity-100'
                        : selectionActive
                          ? 'border-white/55 bg-background/35 text-transparent opacity-100 backdrop-blur'
                          : 'border-white/70 bg-background/45 text-transparent opacity-0 backdrop-blur group-hover:opacity-100'
                    }`}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                  {item.galleryPost ? (
                    <span className="pointer-events-none absolute bottom-2 left-2 z-30 rounded-full bg-background/70 px-2 py-0.5 text-xs font-bold text-foreground backdrop-blur-md">
                      {item.galleryPost.status === 'PENDING'
                        ? t('badgePending')
                        : item.galleryPost.status === 'PUBLISHED'
                          ? t('badgePublished')
                          : item.galleryPost.status === 'REJECTED'
                            ? t('badgeRejected')
                            : item.galleryPost.status === 'HIDDEN'
                              ? t('badgeHidden')
                              : t('badgeUnpublished')}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 多选操作栏：向上渐隐展示（替代输入框；输入框由父级向下淡出） */}
      <div
        className={`fixed inset-x-0 bottom-[30px] z-50 flex justify-center px-4 transition-all duration-300 ${selectionActive ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
      >
        <div className="growth-panel-shadow pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(32,34,37,0.88),rgba(24,26,29,0.92))] p-2 backdrop-blur-[32px]">
          <span className="mr-1 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-1.5 text-sm font-bold text-foreground">
            {selectedImageList.length > 0 ? (
              <span className="flex items-center">
                {selectedImageList.slice(0, 3).map(({ image }, index, arr) => (
                  <img
                    key={index}
                    src={image.url}
                    alt=""
                    className="size-6 shrink-0 rounded-md border border-white/15 object-cover shadow-md"
                    style={{
                      marginLeft: index === 0 ? 0 : -10,
                      transform:
                        arr.length > 1
                          ? `rotate(${(index - (arr.length - 1) / 2) * 9}deg)`
                          : undefined,
                      zIndex: arr.length - index,
                    }}
                  />
                ))}
              </span>
            ) : null}
            {selectedKeys.size} selected
          </span>
          <button
            type="button"
            onClick={downloadSelected}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground/85 transition hover:bg-white/5"
          >
            <Download className="size-4" /> Download
          </button>
          <button
            type="button"
            onClick={() => void publishNow(selectedImageList)}
            disabled={publishing}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground/85 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
          >
            <Share2 className="size-4" /> {t('publishAll')}
          </button>
          <button
            type="button"
            onClick={requestDelete}
            aria-label={t('ariaDelete')}
            className="grid size-9 place-items-center rounded-xl text-foreground/85 transition hover:bg-white/5"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={clearSelection}
            aria-label={t('close')}
            className="grid size-9 place-items-center rounded-xl text-foreground/85 transition hover:bg-white/5"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <PublicImageDetailDialog
        item={selectedItem}
        locale={locale}
        onClose={() => setSelectedItem(null)}
        onRecreate={onRecreate}
        onUseAsReference={onUseAsReference}
        // 详情里切到别的候选图 → 「最后查看」标记跟着走
        onActiveImageChange={(item, image) => setLastViewedKey(imageKey(item.id, image))}
        onHistoryChanged={onHistoryChanged}
      />
      <DeleteGenerationsDialog
        open={deleteDialogOpen}
        generationCount={selectedGenerationIds.length}
        imageCount={affectedImageCount}
        deleting={deleting}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
      {/* 悬浮菜单的单图删除：同一个确认框，count 恒为 1 */}
      <DeleteGenerationsDialog
        open={singleDeleteItem !== null}
        generationCount={1}
        imageCount={singleDeleteItem?.images.length ?? 0}
        deleting={deleting}
        onClose={() => setSingleDeleteItem(null)}
        onConfirm={() => void confirmSingleDelete()}
      />
    </>
  );
}

/** 生成中占位块：按 justified 计算出的 width/height 渲染；深色 + 泛绿光，仅首块显示 Generating 标签 */
function GeneratingCell({
  width,
  height,
  showLabel,
}: {
  width: number;
  height: number;
  showLabel: boolean;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  return (
    <div
      className="growth-flow-border relative min-w-0 overflow-hidden bg-secondary"
      style={{ width, height }}
      aria-live="polite"
      aria-label={t('generating')}
    >
      <div className="absolute inset-0 growth-history-empty-bg" />
      <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" />
      {showLabel ? (
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 text-sm font-bold text-growth-accent">
          <span className="size-4 rounded-full border-2 border-growth-accent border-t-transparent animate-spin" />
          {t('generating')}
        </div>
      ) : null}
    </div>
  );
}
