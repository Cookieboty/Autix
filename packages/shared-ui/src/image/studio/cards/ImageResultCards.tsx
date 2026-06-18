import { useState } from 'react';
import {
  Copy,
  Download,
  Loader2,
  Maximize2,
  RefreshCcw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../ui/utils';
import { IconAction } from '../shared/PrimitiveControls';
import type { ImageResultItem } from '../../../chat/MessageBubble';
import type { ImageWorkbenchHistoryItem, MaterialAsset } from '@autix/shared-lib';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function settingText(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value;
  return null;
}

function collectSettingChips(item: ImageWorkbenchHistoryItem) {
  const settings = item.settings ?? {};
  return [
    item.modelUsed,
    settingText(settings.size),
    settingText(settings.quality),
    `${item.images.length || item.generatedImages.length || 1} 张`,
    settingText(settings.stylePreset),
    settingText(settings.seed) ? `Seed ${settingText(settings.seed)}` : null,
    item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : null,
  ].filter((chip): chip is string => Boolean(chip));
}

function resultToImageItem(
  result: ImageWorkbenchHistoryItem['images'][number],
  fallbackPrompt: string,
): ImageResultItem {
  return {
    url: result.url,
    prompt: result.prompt ?? fallbackPrompt,
    generationId: result.generationId,
    index: result.index,
    sourceImages: result.sourceImages,
  };
}

export function ImageHistoryTaskCard({
  item,
  selectedUrls,
  onPreview,
  onUseAsSource,
  onApplyTask,
  onAddToMaterial,
  onDeleteTask,
}: {
  item: ImageWorkbenchHistoryItem;
  selectedUrls: Set<string>;
  onPreview: (image: ImageResultItem) => void;
  onUseAsSource: (image: ImageResultItem) => void;
  onApplyTask: () => void;
  onAddToMaterial?: (image: ImageResultItem) => void;
  onDeleteTask?: () => void;
}) {
  const chips = collectSettingChips(item);
  const modeLabel = item.mode === 'edit' ? '编辑任务' : '生成任务';
  const sourceRefs = item.sourceImages ?? [];
  const referenceRefs = item.referenceImages ?? [];

  return (
    <article className="group overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary/45">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{modeLabel}</span>
              <span>{formatDateTime(item.createdAt)}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-foreground">
              {item.resolvedPrompt || '没有提示词记录'}
            </p>
          </div>
          {onDeleteTask && (
            <button
              type="button"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={onDeleteTask}
              title="删除历史任务"
              aria-label="删除历史任务"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className="max-w-full truncate rounded border border-border bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>

        {(sourceRefs.length > 0 || referenceRefs.length > 0) && (
          <div className="flex items-center gap-1.5 overflow-hidden">
            {[...sourceRefs, ...referenceRefs].slice(0, 6).map((ref, index) => (
              <button
                key={`${ref.url}-${index}`}
                type="button"
                className="relative size-8 shrink-0 overflow-hidden rounded border border-border bg-muted"
                onClick={() => onUseAsSource({ ...ref, prompt: ref.prompt ?? item.resolvedPrompt })}
                title={index < sourceRefs.length ? '编辑源' : '参考图'}
              >
                <img src={ref.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <span className="min-w-0 truncate text-[10px] text-muted-foreground">
              {sourceRefs.length} 编辑源 · {referenceRefs.length} 参考图
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-2">
        {item.images.map((result) => {
          const image = resultToImageItem(result, item.resolvedPrompt);
          const selected = selectedUrls.has(image.url);
          return (
            <div
              key={`${result.url}-${result.index}`}
              className={cn(
                'relative overflow-hidden rounded border bg-muted',
                selected ? 'border-primary ring-1 ring-primary/35' : 'border-border',
              )}
            >
              <button
                type="button"
                className="block aspect-square w-full overflow-hidden"
                onClick={() => onPreview(image)}
              >
                <img src={result.url} alt={image.prompt ?? ''} className="h-full w-full object-cover" />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded bg-background/92 shadow-sm backdrop-blur hover:bg-primary hover:text-primary-foreground',
                    selected ? 'text-primary' : 'text-muted-foreground',
                  )}
                  onClick={() => onUseAsSource(image)}
                  title={selected ? '已在编辑区' : '作为编辑源'}
                  aria-label={selected ? '已在编辑区' : '作为编辑源'}
                >
                  <RefreshCcw className="size-3" />
                </button>
                {onAddToMaterial && (
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded bg-background/92 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
                    onClick={() => onAddToMaterial(image)}
                    title="加入素材库"
                    aria-label="加入素材库"
                  >
                    <Upload className="size-3" />
                  </button>
                )}
              </div>
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                #{result.index + 1}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-accent"
          onClick={onApplyTask}
        >
          <RotateCcw className="size-3.5" />
          复用提示词与参数
        </button>
      </div>
    </article>
  );
}

export function HistoryImageCard({
  image,
  index,
  selected,
  onPreview,
  onUseAsSource,
  onAddToMaterial,
  onDelete,
}: {
  image: ImageResultItem;
  index: number;
  selected: boolean;
  onPreview: () => void;
  onUseAsSource: () => void;
  onAddToMaterial?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md border bg-background transition-colors hover:border-primary/45',
        selected ? 'border-primary ring-1 ring-primary/35' : 'border-border',
      )}
    >
      <button
        type="button"
        className="relative block aspect-square w-full overflow-hidden bg-muted"
        onClick={onPreview}
      >
        <img
          src={image.url}
          alt={image.prompt ?? ''}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          #{index + 1}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          className="absolute right-1.5 top-1.5 z-10 inline-flex size-7 items-center justify-center rounded-full border border-red-500/25 bg-background/90 text-red-500 opacity-0 shadow-sm backdrop-blur transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={onDelete}
          title="删除"
          aria-label="删除历史产物"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      <div className={cn('grid border-t border-border', onAddToMaterial ? 'grid-cols-2' : 'grid-cols-1')}>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center justify-center gap-1 text-[11px] hover:bg-accent hover:text-primary',
            onAddToMaterial && 'border-r border-border',
            selected ? 'text-primary' : 'text-muted-foreground',
          )}
          onClick={onUseAsSource}
        >
          <RefreshCcw className="size-3" />
          {selected ? '已选' : '编辑'}
        </button>
        {onAddToMaterial && (
          <button
            type="button"
            className="inline-flex h-7 items-center justify-center gap-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onAddToMaterial}
          >
            <Upload className="size-3" />
            入库
          </button>
        )}
      </div>
    </div>
  );
}

export function MaterialImageCard({
  asset,
  index,
  selected,
  onPreview,
  onUseAsSource,
  onDelete,
}: {
  asset: MaterialAsset;
  index: number;
  selected: boolean;
  onPreview: () => void;
  onUseAsSource: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md border bg-background transition-colors hover:border-primary/45',
        selected ? 'border-primary ring-1 ring-primary/35' : 'border-border',
      )}
    >
      <button
        type="button"
        className="relative block aspect-square w-full overflow-hidden bg-muted"
        onClick={onPreview}
      >
        <img
          src={asset.url}
          alt={asset.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          M{index + 1}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          className="absolute right-1.5 top-1.5 z-10 inline-flex size-7 items-center justify-center rounded-full border border-red-500/25 bg-background/90 text-red-500 opacity-0 shadow-sm backdrop-blur transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={onDelete}
          title="删除"
          aria-label="删除素材"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      <div className="grid grid-cols-2 border-t border-border">
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center justify-center gap-1 border-r border-border text-[11px] hover:bg-accent hover:text-primary',
            selected ? 'text-primary' : 'text-muted-foreground',
          )}
          onClick={onUseAsSource}
        >
          <RefreshCcw className="size-3" />
          {selected ? '已选' : '使用'}
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center justify-center gap-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onPreview}
        >
          <Maximize2 className="size-3" />
          预览
        </button>
      </div>
    </div>
  );
}

export function GeneratedImageCard({
  image,
  onPreview,
  onUseAsSource,
  onSubmitFeedback,
  onAddToMaterial,
}: {
  image: ImageResultItem;
  onPreview: () => void;
  onUseAsSource: () => void;
  onSubmitFeedback?: (image: ImageResultItem, rating: 1 | 5) => Promise<void> | void;
  onAddToMaterial?: () => Promise<void> | void;
}) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'sent'>('idle');
  const [materialSaving, setMaterialSaving] = useState(false);

  const submitFeedback = async (rating: 1 | 5) => {
    if (!onSubmitFeedback || !image.generationId || feedbackState !== 'idle') return;
    setFeedbackState('submitting');
    try {
      await onSubmitFeedback(image, rating);
      setFeedbackState('sent');
      toast.success('反馈已记录');
    } catch (err) {
      setFeedbackState('idle');
      toast.error(err instanceof Error ? err.message : '反馈提交失败');
    }
  };

  const saveToMaterial = async () => {
    if (!onAddToMaterial || materialSaving) return;
    setMaterialSaving(true);
    try {
      await onAddToMaterial();
    } finally {
      setMaterialSaving(false);
    }
  };

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-background">
      <button type="button" className="block aspect-square w-full overflow-hidden bg-muted" onClick={onPreview}>
        <img
          src={image.url}
          alt={image.prompt ?? ''}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      </button>
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <div className="min-w-0 text-[11px] text-muted-foreground">
          <p className="truncate">{image.prompt ?? 'Generated image'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSubmitFeedback && image.generationId && (
            <>
              <IconAction
                label="结果有帮助"
                disabled={feedbackState !== 'idle'}
                onClick={() => void submitFeedback(5)}
              >
                <ThumbsUp className="size-3.5" />
              </IconAction>
              <IconAction
                label="结果需改进"
                disabled={feedbackState !== 'idle'}
                onClick={() => void submitFeedback(1)}
              >
                <ThumbsDown className="size-3.5" />
              </IconAction>
            </>
          )}
          <IconAction label="作为编辑源" onClick={onUseAsSource}>
            <RefreshCcw className="size-3.5" />
          </IconAction>
          {onAddToMaterial && (
            <IconAction label="加入素材库" disabled={materialSaving} onClick={() => void saveToMaterial()}>
              {materialSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            </IconAction>
          )}
          <IconAction label="预览" onClick={onPreview}>
            <Maximize2 className="size-3.5" />
          </IconAction>
          <IconAction label="复制地址" onClick={() => void navigator.clipboard?.writeText(image.url)}>
            <Copy className="size-3.5" />
          </IconAction>
          <a
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href={image.url}
            download
            title="下载"
          >
            <Download className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
