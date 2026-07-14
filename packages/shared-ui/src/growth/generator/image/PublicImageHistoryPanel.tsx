'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  ImageIcon,
  Info,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { galleryActions, galleryErrorMessage, publicGeneratorActions } from '@autix/shared-store';
import type {
  PublicImageHistoryImage,
  PublicImageHistoryItem,
} from './public-image-generation';
import type { TemplateDensity } from '../generator-studio-helpers';
import { PublishToGalleryDialog } from './PublishToGalleryDialog';
import { dedupeGenerationIds, galleryPostActions, summarizeSettled } from './gallery-interaction-model';
import { DeleteGenerationsDialog } from './DeleteGenerationsDialog';
import { Button } from '../../../ui/button';

export type PendingImageGenerationCard = {
  id: string;
  prompt: string;
  model: string;
  count: number;
  /** 生成时选择的尺寸/比例（如 "1024x1536" / "3:4"），占位块据此按比例渲染 */
  size?: string;
};

// 历史 Tab：横向 justified 行布局；行高由密度档位决定（档位越密行越矮），滑块调整行高
const HISTORY_ROW_HEIGHT: Record<TemplateDensity, number> = {
  xrelaxed: 700,
  relaxed: 560,
  normal: 440,
  dense: 340,
  xdense: 260,
};

/** 从尺寸串解析宽高比（w/h）：支持 "1024x1024" / "3:4" / "1024×1024@1K"，无法解析回退 1 */
function parseAspectRatio(size?: string): number {
  if (!size) return 1;
  const match = size.match(/(\d+)\s*[x:×]\s*(\d+)/i);
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return 1;
}

const HISTORY_GAP = 3;

/**
 * justified 行打包：按目标行高贪心分行；每满一行再按容器宽度反算实际行高，
 * 使整行正好铺满宽度 —— 每张图始终按真实比例展示（不裁切），窗口缩小时整体等比缩小。
 */
function buildJustifiedRows<T extends { ratio: number }>(
  cells: T[],
  containerWidth: number,
  targetHeight: number,
): Array<{ cells: T[]; height: number }> {
  if (containerWidth <= 0 || cells.length === 0) return [];
  const rows: Array<{ cells: T[]; height: number }> = [];
  let row: T[] = [];
  let ratioSum = 0;
  for (const cell of cells) {
    row.push(cell);
    ratioSum += cell.ratio;
    const naturalWidth = ratioSum * targetHeight + (row.length - 1) * HISTORY_GAP;
    if (naturalWidth >= containerWidth) {
      const available = containerWidth - (row.length - 1) * HISTORY_GAP;
      rows.push({ cells: row, height: available / ratioSum });
      row = [];
      ratioSum = 0;
    }
  }
  // 末行不拉伸，保持目标行高（左对齐、右侧留白）
  if (row.length) rows.push({ cells: row, height: targetHeight });
  return rows;
}

/** 订阅元素宽度（ResizeObserver，callback ref 以适配元素延迟挂载），用于 justified 行高计算 */
function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  return { ref, width };
}

function imageKey(itemId: string, image: PublicImageHistoryImage): string {
  return `${itemId}::${image.generationId ?? ''}::${image.index}`;
}

/** 客户端下载图片：优先 fetch→blob（可跨域时回退新窗口打开） */
async function downloadImageFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  }
}

function formatTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PublicImageHistoryPanel({
  items,
  loading,
  density,
  pending,
  onRecreate,
  onSelectionActiveChange,
  onHistoryChanged,
}: {
  items: PublicImageHistoryItem[];
  loading: boolean;
  density: TemplateDensity;
  pending?: PendingImageGenerationCard | null;
  /** 点击某张图的 Recreate：把该次生成的 prompt 应用到输入框 */
  onRecreate?: (item: PublicImageHistoryItem) => void;
  /** 是否处于多选态：父级据此切换「输入框 ↔ 操作栏」 */
  onSelectionActiveChange?: (active: boolean) => void;
  /** 发布/删除成功后请求父级重拉 history（徽章状态来自服务端，不靠本地内存猜）。 */
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const locale = useLocale();
  const [selectedItem, setSelectedItem] = useState<PublicImageHistoryItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { ref: containerRef, width: containerWidth } = useElementWidth<HTMLDivElement>();

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

  if (loading && items.length === 0 && !pending) {
    return (
      <div className="grid min-h-[240px] place-items-center rounded-[18px] border border-border bg-card/76 text-sm font-semibold text-foreground/45">
        {t('loadingHistory')}
      </div>
    );
  }

  if (items.length === 0 && !pending) {
    return (
      <div className="growth-flow-border relative grid min-h-[240px] place-items-center overflow-hidden rounded-[18px] border border-border bg-card/76 p-6 text-center">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-28 opacity-20" />
        <div className="relative grid size-14 place-items-center rounded-full border border-growth-accent/35 bg-growth-accent/10 text-growth-accent">
          <ImageIcon className="size-6" />
        </div>
        <div className="relative mt-4">
          <h2 className="text-xl font-black uppercase">{t('emptyHistory')}</h2>
          <p className="mt-2 text-sm font-semibold text-foreground/45">
            {t('imageBlankDescription')}
          </p>
        </div>
      </div>
    );
  }

  const targetHeight = HISTORY_ROW_HEIGHT[density];
  const pendingRatio = parseAspectRatio(pending?.size);

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
    ...(pending
      ? Array.from({ length: Math.max(1, pending.count) }).map((_, index) => ({
          kind: 'pending' as const,
          ratio: pendingRatio,
          showLabel: index === 0,
          key: `pending-${index}`,
        }))
      : []),
    ...items.flatMap((item) =>
      item.images.map((image) => ({
        kind: 'image' as const,
        ratio: parseAspectRatio(typeof item.settings.size === 'string' ? item.settings.size : undefined),
        item,
        image,
        key: imageKey(item.id, image),
      })),
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
  const publishSelected = () => {
    if (selectedImageList.length === 0) return;
    setPublishDialogOpen(true);
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
              return (
                <div
                  key={key}
                  className={`group relative min-w-0 overflow-hidden border-solid border-white bg-secondary transition-all duration-75 ${selected ? 'border-[3px]' : 'border-0'}`}
                  style={{ width, height: row.height }}
                >
                  <img
                    src={image.url}
                    alt={image.prompt ?? item.prompt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {/* 点击：多选态下切换选中，否则打开详情 */}
                  <button
                    type="button"
                    aria-label={image.prompt ?? item.prompt}
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={() => (selectionActive ? toggleKey(setSelectedKeys, key) : setSelectedItem(item))}
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
            onClick={publishSelected}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground/85 transition hover:bg-white/5"
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
      <PublicImageHistoryDialog
        item={selectedItem}
        locale={locale}
        onClose={() => setSelectedItem(null)}
        onHistoryChanged={onHistoryChanged}
      />
      <PublishToGalleryDialog
        open={publishDialogOpen}
        selections={selectedImageList}
        onClose={() => setPublishDialogOpen(false)}
        onPublished={({ succeeded, failed }) => {
          if (failed === 0) toast.success(t('publishSubmittedToast', { count: succeeded }));
          else toast.warning(t('publishPartialFailedToast', { succeeded, failed }));
          clearSelection();
          onHistoryChanged?.();
        }}
      />
      <DeleteGenerationsDialog
        open={deleteDialogOpen}
        generationCount={selectedGenerationIds.length}
        imageCount={affectedImageCount}
        deleting={deleting}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void confirmDelete()}
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

function PublicImageHistoryDialog({
  item,
  locale,
  onClose,
  onHistoryChanged,
}: {
  item: PublicImageHistoryItem | null;
  locale: string;
  onClose: () => void;
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [copied, setCopied] = useState(false);
  const [activeImage, setActiveImage] = useState<PublicImageHistoryImage | null>(null);
  const [posting, setPosting] = useState(false);
  const images = item?.images ?? [];
  const image = activeImage ?? images[0] ?? null;
  const prompt = image?.prompt ?? item?.prompt ?? '';
  const post = item?.galleryPost;
  const actions = galleryPostActions(post?.status);

  /**
   * 帖级动作。四条出边对应后端状态机（gallery.helpers.ts TRANSITIONS）：
   * PENDING→REMOVED（撤回）、PUBLISHED→UNPUBLISHED（下架）、
   * REJECTED|UNPUBLISHED→PENDING（重新提交）、REJECTED|UNPUBLISHED|HIDDEN→REMOVED（删帖）。
   * HIDDEN 是管理员处罚，republish 会 400 —— galleryPostActions 不会给出 canRepublish，
   * 所以这里也不会渲染那个按钮。
   */
  const runPostAction = async (action: 'withdraw' | 'unpublish' | 'republish' | 'removePost') => {
    if (!post || posting) return;
    setPosting(true);
    try {
      if (action === 'withdraw' || action === 'removePost') await galleryActions.remove(post.id);
      else if (action === 'unpublish') await galleryActions.unpublish(post.id);
      else await galleryActions.republish(post.id);
      toast.success(t('postActionDoneToast'));
      onHistoryChanged?.();
      onClose();
    } catch (err) {
      toast.error(galleryErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    if (!item) return;
    setCopied(false);
    setActiveImage(item.images[0] ?? null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const copyPrompt = () => {
    if (!prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex bg-background/82 text-foreground backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={prompt || t('history')}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div className="relative z-10 grid min-h-0 w-full grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_390px] md:p-6">
        <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden rounded-md bg-secondary">
          {image ? (
            <img
              src={image.url}
              alt={prompt || t('prompt')}
              className="max-h-[calc(100svh-3rem)] max-w-full rounded-md object-contain"
            />
          ) : (
            <div className="grid size-40 place-items-center rounded-md bg-secondary text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="growth-dialog-shadow flex min-h-0 flex-col rounded-md border border-border bg-card/96 p-4">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-growth-accent text-background">
                <WandSparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">{t('historyDetail')}</h2>
                <p className="truncate text-sm font-semibold text-foreground/45">
                  {formatTime(item.createdAt, locale)}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-foreground/50 hover:bg-secondary hover:text-foreground"
              aria-label={t('close')}
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="rounded-md bg-secondary p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-xs font-black uppercase text-foreground/50">
                  <Sparkles className="size-4" />
                  {t('prompt')}
                </h3>
                <button
                  type="button"
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-bold text-foreground/72 hover:bg-secondary hover:text-foreground"
                  onClick={copyPrompt}
                >
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyPrompt')}
                </button>
              </div>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/18 p-3 text-sm font-medium leading-6 text-foreground/62">
                {prompt || t('noPrompt')}
              </p>
            </section>

            {images.length > 1 ? (
              <section className="grid grid-cols-4 gap-2">
                {images.map((candidate) => (
                  <button
                    key={`${candidate.generationId ?? item.id}-${candidate.index}`}
                    type="button"
                    onClick={() => setActiveImage(candidate)}
                    className={`relative aspect-square overflow-hidden rounded-md border bg-background ${candidate.url === image?.url ? 'border-growth-accent ring-2 ring-growth-accent/25' : 'border-border hover:border-input'}`}
                  >
                    <img
                      src={candidate.url}
                      alt={candidate.prompt ?? item.prompt}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </section>
            ) : null}

            <section className="rounded-md bg-secondary p-4">
              <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase text-foreground/50">
                <Info className="size-4" />
                {t('information')}
              </h3>
              <div className="divide-y divide-border text-sm">
                <HistoryInfoRow label={t('model')} value={item.model || t('auto')} />
                <HistoryInfoRow label={t('createdAt')} value={formatTime(item.createdAt, locale)} />
                <HistoryInfoRow label={t('imageCount')} value={String(images.length)} />
                <HistoryInfoRow label={t('imageSize')} value={String(item.settings.size || '-')} />
              </div>
            </section>
          </div>

          {post ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {post.status === 'REJECTED' && post.rejectReason ? (
                <p className="w-full text-sm text-destructive">
                  {t('rejectReasonLabel')}：{post.rejectReason}
                </p>
              ) : null}
              {actions.canWithdraw ? (
                <Button type="button" variant="outline" disabled={posting} onClick={() => void runPostAction('withdraw')}>
                  {t('withdrawSubmission')}
                </Button>
              ) : null}
              {actions.canUnpublish ? (
                <Button type="button" variant="outline" disabled={posting} onClick={() => void runPostAction('unpublish')}>
                  {t('unpublishPost')}
                </Button>
              ) : null}
              {actions.canRepublish ? (
                <Button type="button" variant="outline" disabled={posting} onClick={() => void runPostAction('republish')}>
                  {t('republishPost')}
                </Button>
              ) : null}
              {actions.canRemovePost ? (
                <Button type="button" variant="destructive" disabled={posting} onClick={() => void runPostAction('removePost')}>
                  {t('removePost')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>,
    document.body,
  );
}

function HistoryInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <span className="text-foreground/42">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-foreground/78">{value}</span>
    </div>
  );
}
