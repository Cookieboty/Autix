import { ChevronDown, Loader2, Play, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem, VideoClip } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { ModelPickerPopover } from '../../../chat/ModelPickerPopover';
import { canGenerateClip } from '../constants';

export function VideoWorkspacePromptActionBar({
  clip,
  canOptimize,
  optimizingPrompt,
  textModelId,
  textModels,
  textModelsLoading,
  modelConfigId,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  canGenerate: canGenerateOverride,
  onOptimizePrompt,
  onTextModelChange,
  onVideoModelChange,
  onGenerate,
}: {
  clip: VideoClip | null;
  canOptimize: boolean;
  optimizingPrompt: boolean;
  textModelId: string | null;
  textModels: ModelConfigItem[];
  textModelsLoading: boolean;
  modelConfigId: string;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  canGenerate?: boolean;
  onOptimizePrompt: () => void;
  onTextModelChange: (modelId: string | null) => void;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const t = useTranslations('videoWorkbench.configPanel');
  const selectedTextModel = textModels.find((model) => model.id === textModelId);
  const selectedVideoModel = videoModels.find((model) => model.id === modelConfigId);
  const canGenerateSelectedClip = canGenerateOverride ?? (clip ? canGenerateClip(clip) : false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        {textModels.length > 0 ? (
          <ModelPickerPopover
            candidates={textModels}
            value={textModelId}
            onChange={onTextModelChange}
            labels={{
              searchPlaceholder: t('actionBar.textModelSearchPlaceholder'),
              empty: t('actionBar.textModelEmptyResult'),
            }}
            trigger={
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-[178px]"
                disabled={optimizingPrompt}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {t('actionBar.textModelLabel', { name: selectedTextModel?.name ?? t('actionBar.defaultLabel') })}
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            }
          />
        ) : (
          <button
            type="button"
            className="flex h-9 w-full items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2.5 text-left text-xs text-muted-foreground sm:w-[178px]"
            disabled
          >
            {textModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="truncate">
              {textModelsLoading ? t('actionBar.textModelLoading') : t('actionBar.textModelDefault')}
            </span>
          </button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-3"
          disabled={!canOptimize}
          onClick={onOptimizePrompt}
        >
          {optimizingPrompt ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {t('actionBar.aiOptimize')}
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
        {videoModels.length > 0 ? (
          <ModelPickerPopover
            candidates={videoModels}
            value={modelConfigId}
            onChange={(id) => id && onVideoModelChange(id)}
            labels={{
              searchPlaceholder: t('actionBar.videoModelSearchPlaceholder'),
              empty: t('actionBar.videoModelEmptyResult'),
            }}
            trigger={
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-[220px]"
                disabled={!clip || clip.status === 'generating'}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {t('actionBar.videoModelLabel', { name: selectedVideoModel?.name ?? t('actionBar.selectModel') })}
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            }
          />
        ) : (
          <button
            type="button"
            className="flex h-9 w-full items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2.5 text-left text-xs text-muted-foreground sm:w-[220px]"
            disabled
          >
            {videoModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="truncate">
              {videoModelsLoading ? t('actionBar.videoModelLoading') : t('actionBar.videoModelEmpty')}
            </span>
          </button>
        )}

        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-3"
          disabled={!clip || !canGenerateSelectedClip || clip.status === 'generating' || videoModels.length === 0}
          onClick={() => clip && onGenerate(clip)}
        >
          {clip?.status === 'generating' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          {t('actionBar.generateVideo')}
          {estimatingCost ? (
            <Loader2 className="size-3 animate-spin opacity-80" />
          ) : estimatedCost != null ? (
            <span className="text-[11px] opacity-90">{t('actionBar.credits', { value: estimatedCost })}</span>
          ) : null}
        </Button>
      </div>
    </div>
  );
}
