'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Ellipsis, Eye, Film, Pause, Play, RefreshCw, Share2, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  galleryActions,
  galleryErrorMessage,
  publicGeneratorActions,
  type DirectVideoGenerationDto,
} from '@autix/shared-store';
import type { TemplateDensity } from '../generator-studio-helpers';
import { buildJustifiedRows, useElementWidth } from '../justified-rows';
import { ImageActionMenu } from '../image/ImageActionMenu';
import { galleryPostActions, summarizeSettled } from '../image/gallery-interaction-model';
import { downloadImageFile } from '../image/image-history-media';
import { resolveGalleryShareUrl } from '../image/gallery-share-link';
import { DeleteGenerationsDialog } from '../image/DeleteGenerationsDialog';
import { useLocalizePath } from '../../../navigation';
import { buildVideoActionMenuItems } from './video-action-items';
import { PublicVideoDetailDialog } from './PublicVideoDetailDialog';
import { VideoEmptyShowcase } from './VideoEmptyShowcase';
import {
  publishVideosToGallery,
  videoCover,
  videoDisplayStatus,
  videoSettingsRatio,
} from './video-history-model';

export type PendingVideoGenerationCard = {
  id: string;
  title: string;
  prompt: string;
  model: string;
  coverUrl?: string | null;
  /**
   * 本次生成提交的参数包。占位块据此解析比例渲染 —— 传整个 bag 而不是单个比例串，
   * 与 image 侧的 PendingImageGenerationCard.settings 同一理由。
   */
  settings?: Record<string, unknown>;
};

// 历史 Tab：横向 justified 行布局；行高由密度档位决定（档位越密行越矮），滑块调整行高。
// 与图片历史同一套档位值——两个 tab 的滑块必须调出同样的观感。
const HISTORY_ROW_HEIGHT: Record<TemplateDensity, number> = {
  xrelaxed: 700,
  relaxed: 560,
  normal: 440,
  dense: 340,
  xdense: 260,
};

/**
 * 历史骨架屏：形状照着 justified 行布局来，数据到位时是「骨架就地变成视频」而不是整块重排。
 * 比例写死不用随机数——SSR 与客户端要算出同一套宽度，否则水合不一致。
 */
const HISTORY_SKELETON_ROWS = [
  [1.77, 0.56, 1],
  [0.56, 1.33, 1.77],
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

export function VideoHistoryPanel({
  items,
  loading,
  pending,
  density,
  onRecreate,
  onSelectionActiveChange,
  onHistoryChanged,
}: {
  items: DirectVideoGenerationDto[];
  loading?: boolean;
  pending?: PendingVideoGenerationCard | null;
  /** 卡片密度，来自右上角滑块 */
  density: TemplateDensity;
  /** 点击 Recreate：把该次生成的 prompt 应用回输入框 */
  onRecreate?: (item: DirectVideoGenerationDto) => void;
  /** 是否处于多选态：父级据此切换「输入框 ↔ 操作栏」 */
  onSelectionActiveChange?: (active: boolean) => void;
  /** 发布/删除成功后请求父级重拉 history（徽章状态来自服务端，不靠本地内存猜）。 */
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const locale = useLocale();
  const localize = useLocalizePath();
  const [selectedItem, setSelectedItem] = useState<DirectVideoGenerationDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** 投稿请求进行中：期间不接受重复的发布点击（发布已无确认弹窗兜着，点两下就是两条帖）。 */
  const [publishing, setPublishing] = useState(false);
  /** 悬浮菜单里「删除视频」选中的那一条（与多选删除共用确认框，只是 count 恒为 1）。 */
  const [singleDeleteItem, setSingleDeleteItem] = useState<DirectVideoGenerationDto | null>(null);
  /** 最后看过的那条：关掉详情后该格盖一层遮罩，历史很长时能一眼找回位置。 */
  const [lastViewedId, setLastViewedId] = useState<string | null>(null);
  /** 正在跑帖级动作的那条 —— 菜单项据此禁用，避免连点。 */
  const [postingItemId, setPostingItemId] = useState<string | null>(null);
  const { ref: containerRef, width: containerWidth } = useElementWidth<HTMLDivElement>();
  /**
   * 视频加载出元数据后按 videoWidth/videoHeight 校正的真实比例。
   * 加载前用本次生成选择的 ratio 占位 —— 厂商实际返回的画幅未必等于请求值
   * （adaptive 模式尤其如此），拿请求值当最终值会让整行错位。
   */
  const [naturalRatios, setNaturalRatios] = useState<Record<string, number>>({});

  /**
   * 显式播放（点播放按钮）中的那一条。同一时刻只允许一条，点另一条会先停掉前一条 ——
   * 历史里一屏能放下十几个视频，同时出声就是灾难。
   */
  const [playingId, setPlayingId] = useState<string | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());

  /** 停止某条的显式播放：暂停、归零、重新静音（下次 hover 预览才不会带声音）。 */
  const stopPlayback = (id: string) => {
    const element = videoRefs.current.get(id);
    if (element) {
      element.pause();
      element.currentTime = 0;
      element.muted = true;
      element.loop = true;
    }
    setPlayingId((current) => (current === id ? null : current));
  };

  const togglePlayback = (id: string) => {
    if (playingId === id) {
      stopPlayback(id);
      return;
    }
    if (playingId) stopPlayback(playingId);
    const element = videoRefs.current.get(id);
    if (!element) return;
    // 显式播放 = 用户手势，可以带声音；hover 预览那条路径始终静音。
    // 也不循环：播完就停回封面，避免一直转。
    element.muted = false;
    element.loop = false;
    element.currentTime = 0;
    void element.play().catch(() => {
      // 浏览器仍拒绝（极少见）→ 退回静音再试一次，别让按钮点了没反应
      element.muted = true;
      void element.play().catch(() => undefined);
    });
    setPlayingId(id);
  };

  const rememberNaturalRatio = (id: string, element: HTMLVideoElement) => {
    const { videoWidth, videoHeight } = element;
    if (!videoWidth || !videoHeight) return;
    const ratio = videoWidth / videoHeight;
    setNaturalRatios((prev) => (prev[id] === ratio ? prev : { ...prev, [id]: ratio }));
  };

  const selectionActive = selectedIds.size > 0;
  useEffect(() => {
    onSelectionActiveChange?.(selectionActive);
  }, [selectionActive, onSelectionActiveChange]);
  useEffect(() => () => onSelectionActiveChange?.(false), [onSelectionActiveChange]);

  const toggleId = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openDetail = (item: DirectVideoGenerationDto) => {
    setSelectedItem(item);
    setLastViewedId(item.id);
  };

  const targetHeight = HISTORY_ROW_HEIGHT[density];

  // 加载中：骨架屏（形状照着 justified 行来）。先判加载态、确认没数据了才渲染空状态，
  // 否则刷新时会先闪一下空状态。
  if (loading && items.length === 0 && !pending) {
    return <HistorySkeleton targetHeight={targetHeight} />;
  }

  if (items.length === 0 && !pending) {
    return <VideoEmptyShowcase title={t('emptyVideoHistory')} description={t('emptyVideoHistoryHint')} />;
  }

  type HistoryCell =
    | { kind: 'pending'; ratio: number; key: string }
    | { kind: 'video'; ratio: number; item: DirectVideoGenerationDto; key: string };

  // 生成中占位块 push 到最上方，随后是全部历史；每格带真实比例
  const cells: HistoryCell[] = [
    ...(pending
      ? [
          {
            kind: 'pending' as const,
            ratio: videoSettingsRatio({ options: pending.settings ?? {} } as DirectVideoGenerationDto),
            key: `pending-${pending.id}`,
          },
        ]
      : []),
    ...items.map((item) => ({
      kind: 'video' as const,
      // 加载出元数据的以真实比例为准，未加载的先按本次生成选择的比例占位
      ratio: naturalRatios[item.id] ?? videoSettingsRatio(item),
      item,
      key: item.id,
    })),
  ];

  const rows = buildJustifiedRows(cells, containerWidth, targetHeight);
  const selectedList = items.filter((item) => selectedIds.has(item.id));
  const clearSelection = () => setSelectedIds(new Set());

  const downloadSelected = () =>
    selectedList.forEach((item) => {
      if (item.videoUrl) void downloadImageFile(item.videoUrl, `video-${item.id}.mp4`);
    });

  /** 一键发布（多选工具条 / 单卡悬浮菜单共用）：直接投稿，不弹分类选择框。 */
  const publishNow = async (targets: DirectVideoGenerationDto[]) => {
    const publishable = targets.filter((item) => item.videoUrl);
    if (publishable.length === 0 || publishing) return;
    setPublishing(true);
    try {
      const { succeeded, failed, firstError } = await publishVideosToGallery(publishable);
      if (succeeded === 0) {
        toast.error(galleryErrorMessage(firstError));
        return;
      }
      if (failed === 0) toast.success(t('publishSubmittedVideoToast', { count: succeeded }));
      else toast.warning(t('publishPartialFailedToast', { succeeded, failed }));
      clearSelection();
      onHistoryChanged?.();
    } finally {
      setPublishing(false);
    }
  };

  /** 只要选中项里有任何一条还挂着活帖，就不能删（服务端会 409）。 */
  const deletableSelection = selectedList.every(
    (item) => galleryPostActions(item.galleryPost?.status).canDeleteGeneration,
  );

  const requestDelete = () => {
    if (selectedList.length === 0) return;
    if (!deletableSelection) {
      toast.error(t('deleteVideoBlockedToast'));
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const results = await Promise.allSettled(
      selectedList.map((item) => publicGeneratorActions.deleteVideoHistory(item.id)),
    );
    const { succeeded, failed } = summarizeSettled(results);
    setDeleting(false);
    setDeleteDialogOpen(false);

    if (succeeded > 0 && failed === 0) toast.success(t('deletedVideoToast', { count: succeeded }));
    else if (succeeded > 0) toast.warning(t('deletePartialFailedToast', { succeeded, failed }));
    else toast.error(t('deleteVideoBlockedToast'));

    clearSelection();
    onHistoryChanged?.();
  };

  /** 悬浮菜单里的帖级动作。出边由 galleryPostActions 按后端状态机给。 */
  const runPostAction = async (
    item: DirectVideoGenerationDto,
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

  const confirmSingleDelete = async () => {
    if (!singleDeleteItem) return;
    setDeleting(true);
    try {
      await publicGeneratorActions.deleteVideoHistory(singleDeleteItem.id);
      toast.success(t('deletedVideoToast', { count: 1 }));
      onHistoryChanged?.();
    } catch {
      toast.error(t('deleteVideoBlockedToast'));
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
                return <GeneratingCell key={cell.key} width={width} height={row.height} />;
              }

              const { item } = cell;
              const status = videoDisplayStatus(item);
              // 刷新页面后仍在跑的历史项：与提交态同一个占位块，上游轮询命中终态后自然切换
              if (status === 'processing') {
                return <GeneratingCell key={cell.key} width={width} height={row.height} />;
              }

              const selected = selectedIds.has(item.id);
              const cover = videoCover(item);
              const actions = galleryPostActions(item.galleryPost?.status);

              return (
                <div
                  key={cell.key}
                  className={`group relative min-w-0 overflow-hidden border-solid border-white bg-secondary transition-all duration-75 ${selected ? 'border-[3px]' : 'border-0'}`}
                  style={{ width, height: row.height }}
                >
                  {status === 'failed' ? (
                    <div className="grid h-full w-full place-items-center gap-2 px-3 text-center text-foreground/40">
                      <Film className="size-8" />
                      <span className="text-xs font-bold">{t('generateFailed')}</span>
                    </div>
                  ) : (
                    <video
                      src={item.videoUrl ?? undefined}
                      poster={cover ?? undefined}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                      // 元数据到位就校正比例；命中缓存时 loadedmetadata 可能已经过了，
                      // 所以 ref 里也读一次（readyState>=1 表示元数据已就绪）
                      ref={(element) => {
                        if (element) {
                          videoRefs.current.set(item.id, element);
                          if (element.readyState >= 1) rememberNaturalRatio(item.id, element);
                        } else {
                          videoRefs.current.delete(item.id);
                        }
                      }}
                      onLoadedMetadata={(event) => rememberNaturalRatio(item.id, event.currentTarget)}
                      // 播完（显式播放不循环）→ 归位成「未播放」，按钮变回 ▶
                      onEnded={() => stopPlayback(item.id)}
                      // 悬浮预览：静音循环播放，移开归零。
                      // 显式播放中的那条完全不参与 —— 否则用户点了播放、鼠标一移开就被掐掉。
                      onMouseEnter={(event) => {
                        if (playingId === item.id) return;
                        void event.currentTarget.play().catch(() => undefined);
                      }}
                      onMouseLeave={(event) => {
                        if (playingId === item.id) return;
                        event.currentTarget.pause();
                        event.currentTarget.currentTime = 0;
                      }}
                    />
                  )}

                  {/* 最后查看过的那条：暗色遮罩 + 标记。z-20 低于悬浮操作按钮(z-30)，
                      pointer-events-none 让点击/悬浮照常穿透 */}
                  {lastViewedId === item.id ? (
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
                    aria-label={item.prompt}
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={() => (selectionActive ? toggleId(item.id) : openDetail(item))}
                  />

                  {/* 悬浮效果：仅非多选态展示内阴影 + 右侧功能图标 */}
                  {!selectionActive ? (
                    <>
                      <div className="pointer-events-none absolute inset-0 z-10 opacity-0 shadow-[inset_0_0_130px_44px_rgba(0,0,0,0.8)] transition duration-200 group-hover:opacity-100" />
                      <div className="absolute right-2 top-2 z-30 flex flex-col gap-1 opacity-0 transition duration-200 group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={t('ariaDownload')}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (item.videoUrl) void downloadImageFile(item.videoUrl, `video-${item.id}.mp4`);
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
                          items={buildVideoActionMenuItems({
                            t,
                            item,
                            actions,
                            posting: postingItemId === item.id,
                            deletable: actions.canDeleteGeneration,
                            runPostAction: (action) => void runPostAction(item, action),
                            onDelete: () => setSingleDeleteItem(item),
                            onOpen: () => openDetail(item),
                            onRecreate: () => onRecreate?.(item),
                            onPublish: () => void publishNow([item]),
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

                  {/* 左上复选框：多选态下全部常显（未选为淡色）；否则悬浮出现 */}
                  <button
                    type="button"
                    aria-label={t('ariaSelect')}
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleId(item.id);
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

                  {/* 播放按钮：右下角、白底深色图标 —— 与资产面板里的视频/音频播放入口同款，
                      三处的播放长相保持一致。多选态下不出现（那时整卡是选择热区）。
                      必须 stopPropagation：底下铺着打开详情的整卡热区。 */}
                  {status === 'completed' && item.videoUrl && !selectionActive ? (
                    <button
                      type="button"
                      aria-label={playingId === item.id ? t('pause') : t('play')}
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePlayback(item.id);
                      }}
                      className="absolute bottom-2 right-2 z-30 grid size-9 cursor-pointer place-items-center rounded-full bg-foreground text-background transition hover:brightness-90"
                    >
                      {playingId === item.id ? (
                        <Pause className="size-4 fill-current" />
                      ) : (
                        <Play className="size-4 translate-x-px fill-current" />
                      )}
                    </button>
                  ) : null}

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
            {selectedList.length > 0 ? (
              <span className="flex items-center">
                {selectedList.slice(0, 3).map((item, index, arr) => {
                  const cover = videoCover(item);
                  return (
                    <span
                      key={item.id}
                      className="size-6 shrink-0 overflow-hidden rounded-md border border-white/15 bg-secondary shadow-md"
                      style={{
                        marginLeft: index === 0 ? 0 : -10,
                        transform:
                          arr.length > 1
                            ? `rotate(${(index - (arr.length - 1) / 2) * 9}deg)`
                            : undefined,
                        zIndex: arr.length - index,
                      }}
                    >
                      {cover ? (
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-foreground/40">
                          <Film className="size-3" />
                        </span>
                      )}
                    </span>
                  );
                })}
              </span>
            ) : null}
            {selectedIds.size} selected
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
            onClick={() => void publishNow(selectedList)}
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

      <PublicVideoDetailDialog
        item={selectedItem}
        locale={locale}
        onClose={() => setSelectedItem(null)}
        onRecreate={onRecreate}
        onHistoryChanged={onHistoryChanged}
      />
      <DeleteGenerationsDialog
        open={deleteDialogOpen}
        generationCount={selectedList.length}
        imageCount={selectedList.length}
        deleting={deleting}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void confirmDelete()}
        kind="video"
      />
      {/* 悬浮菜单的单条删除：同一个确认框，count 恒为 1 */}
      <DeleteGenerationsDialog
        open={singleDeleteItem !== null}
        generationCount={1}
        imageCount={1}
        deleting={deleting}
        onClose={() => setSingleDeleteItem(null)}
        onConfirm={() => void confirmSingleDelete()}
        kind="video"
      />
    </>
  );
}

/** 生成中占位块：按 justified 计算出的 width/height 渲染；深色 + 泛绿光扫描线。 */
function GeneratingCell({ width, height }: { width: number; height: number }) {
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
      <div className="absolute left-3 top-3 inline-flex items-center gap-2 text-sm font-bold text-growth-accent">
        <span className="size-4 rounded-full border-2 border-growth-accent border-t-transparent animate-spin" />
        {t('generating')}
      </div>
    </div>
  );
}
