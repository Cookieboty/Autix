import { useState } from 'react';
import {
  Copy,
  Download,
  Loader2,
  Maximize2,
  RefreshCcw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../ui/utils';
import { IconAction } from '../shared/PrimitiveControls';
import type { ImageResultItem } from '../../../chat/MessageBubble';
import type { MaterialAsset } from '@autix/shared-lib';

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
