import { ChevronDown, Layers, Loader2, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import { ModelPickerPopover } from '../../../chat/ModelPickerPopover';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  STORYBOARD_PRESET_COUNTS,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  suggestStoryboardClipDuration,
} from '../constants';
import { PanelLabel } from '../shared/PanelLabel';

function ImeTextarea({
  value,
  onValueChange,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);
  return (
    <textarea
      {...rest}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!composingRef.current) onValueChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const next = (event.target as HTMLTextAreaElement).value;
        setDraft(next);
        onValueChange(next);
      }}
    />
  );
}

export function StoryboardToolsDialog({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  clipCount,
  onClipCountChange,
  directorModels,
  directorModelId,
  directorModelsLoading,
  onDirectorModelChange,
  loading,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  directorModels: ModelConfigItem[];
  directorModelId: string | null;
  directorModelsLoading: boolean;
  onDirectorModelChange: (modelId: string | null) => void;
  loading: boolean;
  onGenerate: () => void;
}) {
  const t = useTranslations('videoWorkbench.storyboardDialog');
  const tPresets = useTranslations('videoWorkbench.storyboardPresets');
  const selectedDirectorModel = directorModels.find((model) => model.id === directorModelId);
  const suggestedClipDuration = suggestStoryboardClipDuration(clipCount);
  const suggestedTotalDuration = Math.min(
    STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
    suggestedClipDuration * Math.max(1, clipCount),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[72vh] space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t('promptLabel')}</span>
            <ImeTextarea
              className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder={t('promptPlaceholder')}
              value={prompt}
              onValueChange={onPromptChange}
            />
          </label>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <PanelLabel icon={<Layers className="size-3.5" />} label={t('clipCount')} />
              <span className="text-[11px] text-muted-foreground">
                {t('estimatedTotal', {
                  total: suggestedTotalDuration,
                  perClip: suggestedClipDuration,
                })}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {STORYBOARD_PRESET_COUNTS.map((count) => {
                const presetClipDuration = suggestStoryboardClipDuration(count);
                const presetTotalDuration = Math.min(
                  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
                  presetClipDuration * count,
                );
                return (
                  <button
                    key={count}
                    type="button"
                    className={cn(
                      'rounded-lg border px-3 py-3 text-left transition-colors',
                      clipCount === count
                        ? 'border-primary bg-primary/8'
                        : 'border-border bg-background hover:border-primary/45 hover:bg-accent',
                    )}
                    onClick={() => onClipCountChange(count)}
                  >
                    <div className="text-sm font-medium">{tPresets(`count${count}.label`)}</div>
                    <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {tPresets(`count${count}.description`)}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {t('presetSummary', {
                        perClip: presetClipDuration,
                        count,
                        total: presetTotalDuration,
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <PanelLabel icon={<Sparkles className="size-3.5" />} label={t('modelLabel')} />
            {directorModels.length > 0 ? (
              <ModelPickerPopover
                candidates={directorModels}
                value={directorModelId}
                onChange={onDirectorModelChange}
                labels={{
                  searchPlaceholder: t('modelSearchPlaceholder'),
                  empty: t('modelEmptyResult'),
                }}
                trigger={
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {selectedDirectorModel?.name ?? t('modelPlaceholder')}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                }
              />
            ) : (
              <button
                type="button"
                className="flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-left text-xs text-muted-foreground"
                disabled
              >
                {directorModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {directorModelsLoading ? t('modelLoading') : t('modelEmpty')}
              </button>
            )}
          </section>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button type="button" className="gap-1.5" disabled={!prompt.trim() || loading} onClick={onGenerate}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {t('generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
