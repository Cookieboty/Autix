'use client';

import {
  ChevronDown,
  LayoutTemplate,
  Loader2,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageModelCapability } from '@autix/domain/image';
import type { ModelConfigItem } from '@autix/shared-store';
import type { ClipboardEvent, RefObject } from 'react';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import { ModelPickerPopover } from '../../../chat/ModelPickerPopover';
import {
  PROMPT_TUNING_VALUES,
  promptToolbarControlClass,
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
} from '../constants';
import { SelectLike } from '../../../pricing/SchemaForm/primitives/SelectLike';

export function ImageStudioPromptPanel({
  prompt,
  onPromptChange,
  promptTextareaRef,
  imageModels,
  selectedModelId,
  selectedModel,
  onModelChange,
  chatModels,
  selectedChatModelId,
  selectedChatModel,
  onChatModelChange,
  settings,
  onPromptTuningChange,
  capability,
  displayedTemplateName,
  onClearTemplate,
  onUploadClick,
  onPasteFiles,
  canGenerate,
  isGenerating,
  canRefine,
  isRefining,
  onRefinePrompt,
  onGenerate,
  selectedSourceCount,
  estimatingGenerateCost,
  estimatedGenerateCost,
  refineError,
  refineMeta,
  onUndoRefine,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
  imageModels: ModelConfigItem[];
  selectedModelId: string | null;
  selectedModel?: ModelConfigItem;
  onModelChange: (id: string) => void;
  chatModels: ModelConfigItem[];
  selectedChatModelId: string | null;
  selectedChatModel?: ModelConfigItem;
  onChatModelChange: (id: string | null) => void;
  settings: ImageStudioModelSettings;
  onPromptTuningChange: (promptTuning: string) => void;
  capability: ImageModelCapability;
  displayedTemplateName?: string | null;
  onClearTemplate: () => void;
  onUploadClick: () => void;
  onPasteFiles?: (files: FileList | null) => void;
  canGenerate: boolean;
  isGenerating: boolean;
  canRefine: boolean;
  isRefining: boolean;
  onRefinePrompt: () => void;
  onGenerate: () => void;
  selectedSourceCount: number;
  estimatingGenerateCost: boolean;
  estimatedGenerateCost: number | null;
  refineError: string | null;
  refineMeta: {
    before: string;
    result: ImageStudioPromptRefinement;
  } | null;
  onUndoRefine: () => void;
}) {
  const t = useTranslations('imageStudio');
  const tTuning = useTranslations('imageStudio.promptTuning');

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onPasteFiles || !capability.supportsReferenceImage) return;
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (files.length === 0) return;
    event.preventDefault();
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    onPasteFiles(dataTransfer.files);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t('prompt.title')}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t('prompt.subtitle')}</span>
            {displayedTemplateName && (
              <button
                type="button"
                className="inline-flex min-w-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                onClick={onClearTemplate}
                title={t('prompt.removeTemplate')}
              >
                <LayoutTemplate className="size-3" />
                <span className="max-w-[160px] truncate">{displayedTemplateName}</span>
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[460px]">
          {imageModels.length > 0 ? (
            <ModelPickerPopover
              candidates={imageModels}
              value={selectedModelId}
              onChange={(id) => id && onModelChange(id)}
              trigger={
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t('prompt.imageModelPrefix')} · {selectedModel?.name ?? t('prompt.imageModelPlaceholder')}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              }
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              {t('prompt.noImageModelHint')}
            </div>
          )}
          {chatModels.length > 0 && (
            <ModelPickerPopover
              candidates={chatModels}
              value={selectedChatModelId}
              onChange={onChatModelChange}
              trigger={
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t('prompt.refineModelPrefix')} · {selectedChatModel?.name ?? t('prompt.refineModelDefault')}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              }
            />
          )}
        </div>
      </div>
      <textarea
        ref={promptTextareaRef}
        className="min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
        placeholder={t('prompt.placeholder')}
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onPaste={handlePaste}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              promptToolbarControlClass,
              capability.supportsReferenceImage
                ? 'text-muted-foreground hover:border-primary/35 hover:bg-accent hover:text-foreground'
                : 'cursor-not-allowed text-muted-foreground/45',
            )}
            onClick={() => capability.supportsReferenceImage && onUploadClick()}
            title={capability.supportsReferenceImage ? undefined : t('prompt.refUnsupported')}
          >
            <Upload className="size-4" />
            {t('prompt.uploadRef')}
          </button>
          <div className="w-[150px] shrink-0">
            <SelectLike
              value={settings.promptTuning}
              options={PROMPT_TUNING_VALUES.map((value) => ({ label: tTuning(value), value }))}
              onChange={onPromptTuningChange}
              compact
              className="h-10 rounded-lg px-3 text-sm font-medium data-[size=default]:h-10"
            />
          </div>
          <button
            type="button"
            className={cn(
              promptToolbarControlClass,
              canRefine
                ? 'border-primary/35 bg-primary/5 text-primary hover:bg-primary/10'
                : 'cursor-not-allowed text-muted-foreground/45',
            )}
            onClick={onRefinePrompt}
            disabled={!canRefine}
          >
            {isRefining ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {t('prompt.aiRefine')}
          </button>
        </div>
        <Button
          className="h-10 rounded-lg px-5 sm:justify-self-end"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating || imageModels.length === 0}
        >
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span>{selectedSourceCount > 0 ? t('prompt.startEdit') : t('prompt.startGenerate')}</span>
          {estimatingGenerateCost ? (
            <span className="text-xs opacity-80">{t('prompt.estimating')}</span>
          ) : estimatedGenerateCost != null ? (
            <span className="text-xs opacity-90">{t('prompt.costPoints', { points: estimatedGenerateCost })}</span>
          ) : null}
        </Button>
      </div>
      {refineError && (
        <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {refineError}
        </div>
      )}
      {refineMeta && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          <span>{t('prompt.refinedWith', { tuning: tTuning(settings.promptTuning) })}</span>
          <div className="flex items-center gap-2">
            {refineMeta.result.composedPrompt !== refineMeta.result.originalPrompt && (
              <details className="relative">
                <summary className="cursor-pointer text-primary/80 hover:text-primary">
                  {t('prompt.viewContext')}
                </summary>
                <pre className="absolute left-0 top-6 z-20 max-h-48 w-[min(520px,80vw)] overflow-auto rounded-md border border-border bg-popover p-3 text-[11px] leading-5 text-popover-foreground shadow-lg">
                  {refineMeta.result.composedPrompt}
                </pre>
              </details>
            )}
            <button
              type="button"
              className="rounded px-2 py-1 text-primary/80 hover:bg-primary/10 hover:text-primary"
              onClick={onUndoRefine}
            >
              {t('prompt.undoRefine')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
