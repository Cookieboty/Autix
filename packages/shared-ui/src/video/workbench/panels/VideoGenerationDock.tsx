import { ChevronDown, Loader2, Play, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-lib';
import type { VideoClip } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { ModelPickerPopover } from '../../../chat/ModelPickerPopover';
import { canGenerateClip } from '../constants';

export function VideoGenerationDock({
  clip,
  modelConfigId,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  canGenerate: canGenerateOverride,
  onVideoModelChange,
  onGenerate,
}: {
  clip: VideoClip | null;
  modelConfigId: string;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  canGenerate?: boolean;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const t = useTranslations('videoWorkbench.generationDock');
  const canGenerate = canGenerateOverride ?? (clip ? canGenerateClip(clip) : false);
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {videoModels.length > 0 ? (
          <ModelPickerPopover
            candidates={videoModels}
            value={modelConfigId}
            onChange={(id) => id && onVideoModelChange(id)}
            labels={{
              searchPlaceholder: t('modelSearchPlaceholder'),
              empty: t('modelEmptyResult'),
            }}
            trigger={
              <button
                type="button"
                className="flex h-10 min-w-[220px] flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!clip || clip.status === 'generating'}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {videoModels.find((model) => model.id === modelConfigId)?.name ?? t('modelPlaceholder')}
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            }
          />
        ) : (
          <button
            type="button"
            className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-left text-xs text-muted-foreground"
            disabled
          >
            {videoModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="truncate">{videoModelsLoading ? t('modelLoading') : t('modelEmpty')}</span>
          </button>
        )}
        <Button
          type="button"
          className="h-10 gap-1.5 px-4"
          disabled={!clip || !canGenerate || clip.status === 'generating' || videoModels.length === 0}
          onClick={() => clip && onGenerate(clip)}
        >
          {clip?.status === 'generating' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {t('generate')}
          {estimatingCost ? (
            <Loader2 className="size-3.5 animate-spin opacity-80" />
          ) : estimatedCost != null ? (
            <span className="text-xs opacity-90">{t('credits', { value: estimatedCost })}</span>
          ) : null}
        </Button>
      </div>
    </section>
  );
}
