'use client';

import { Upload } from 'lucide-react';
import {
  type ImageWorkbenchHistoryItem,
  type MaterialAsset,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { ImageResultItem } from '../chat/MessageBubble';
import {
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
  type ImageStudioReference,
  type UploadedReference,
} from './studio/constants';
import { ImageAnnotationOverlay } from './studio/annotation/ImageAnnotationOverlay';
import { ImageStudioInspirationAside } from './studio/ImageStudioInspirationAside';
import { ImageStudioWorkspaceHeader } from './studio/ImageStudioWorkspaceHeader';
import { ImageStudioPromptPanel } from './studio/panels/ImageStudioPromptPanel';
import { ImageStudioReferencesPanel } from './studio/panels/ImageStudioReferencesPanel';
import { ImageStudioResultsPanel } from './studio/panels/ImageStudioResultsPanel';
import { ImageStudioSettingsPanel } from './studio/panels/ImageStudioSettingsPanel';
import { useImageStudioWorkspaceController } from './studio/useImageStudioWorkspaceController';

export type {
  ImageStudioReference,
  ImageStudioModelSettings,
  ImageStudioPromptRefinement,
  UploadedReference,
} from './studio/constants';

interface ImageStudioWorkspaceProps {
  initialPrompt?: string;
  initialUploadedRefs?: UploadedReference[];
  imageModels: ModelConfigItem[];
  availableModels: ModelConfigItem[];
  selectedModelId: string | null;
  selectedChatModelId: string | null;
  onModelChange: (id: string) => void;
  onChatModelChange: (id: string | null) => void;
  settings: ImageStudioModelSettings;
  onSettingsChange: (settings: ImageStudioModelSettings) => void;
  activeTemplateName?: string;
  onOpenTemplateEditor?: () => void;
  selectedSourceImages: ImageStudioReference[];
  onRemoveSourceImage: (index: number) => void;
  onClearSourceImages: () => void;
  currentImages: ImageResultItem[];
  historyItems: ImageWorkbenchHistoryItem[];
  materialImages?: MaterialAsset[];
  imageTemplates?: ImageTemplate[];
  initialTemplate?: ImageTemplate | null;
  onClearTemplate?: () => void;
  materialsLoading?: boolean;
  templatesLoading?: boolean;
  isGenerating: boolean;
  estimatedGenerateCost?: number | null;
  estimatingGenerateCost?: boolean;
  onGenerate: (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => void;
  onRefinePrompt?: (payload: {
    prompt: string;
    mode: 'generate' | 'edit';
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => Promise<ImageStudioPromptRefinement>;
  onMergeAnnotation?: (payload: {
    imageUrl: string;
    overlayDataUrl: string;
  }) => Promise<string>;
  onSelectSourceImage?: (image: ImageResultItem) => void;
  onSubmitFeedback?: (image: ImageResultItem, rating: 1 | 5) => Promise<void> | void;
  onAddImageToMaterial?: (image: ImageResultItem) => Promise<void> | void;
  onDeleteHistoryTask?: (item: ImageWorkbenchHistoryItem) => Promise<void> | void;
  onSelectMaterialImage?: (asset: MaterialAsset) => Promise<void> | void;
  onDeleteMaterialImage?: (asset: MaterialAsset) => Promise<void> | void;
}

export function ImageStudioWorkspace({
  initialPrompt,
  initialUploadedRefs,
  imageModels,
  availableModels,
  selectedModelId,
  selectedChatModelId,
  onModelChange,
  onChatModelChange,
  settings,
  onSettingsChange,
  activeTemplateName,
  onOpenTemplateEditor,
  selectedSourceImages,
  onRemoveSourceImage,
  onClearSourceImages,
  currentImages,
  historyItems,
  materialImages = [],
  imageTemplates = [],
  initialTemplate = null,
  onClearTemplate,
  materialsLoading = false,
  templatesLoading = false,
  isGenerating,
  estimatedGenerateCost = null,
  estimatingGenerateCost = false,
  onGenerate,
  onRefinePrompt,
  onMergeAnnotation,
  onSelectSourceImage,
  onSubmitFeedback,
  onAddImageToMaterial,
  onDeleteHistoryTask,
  onSelectMaterialImage,
  onDeleteMaterialImage,
}: ImageStudioWorkspaceProps) {
  const controller = useImageStudioWorkspaceController({
    initialPrompt,
    initialUploadedRefs,
    imageModels,
    availableModels,
    selectedModelId,
    selectedChatModelId,
    onModelChange,
    onChatModelChange,
    settings,
    onSettingsChange,
    activeTemplateName,
    onOpenTemplateEditor,
    selectedSourceImages,
    onRemoveSourceImage,
    onClearSourceImages,
    currentImages,
    historyItems,
    materialImages,
    imageTemplates,
    initialTemplate,
    onClearTemplate,
    materialsLoading,
    templatesLoading,
    isGenerating,
    estimatedGenerateCost,
    estimatingGenerateCost,
    onGenerate,
    onRefinePrompt,
    onMergeAnnotation,
    onSelectSourceImage,
    onSubmitFeedback,
    onAddImageToMaterial,
    onDeleteHistoryTask,
    onSelectMaterialImage,
    onDeleteMaterialImage,
  });

  return (
    <div className="flex h-full min-w-0 bg-background text-foreground">
      {controller.settingsOpen && (
        <button
          type="button"
          aria-label={controller.t('panel.close')}
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm lg:hidden"
          onClick={() => controller.setSettingsOpen(false)}
        />
      )}
      {controller.inspirationOpen && (
        <button
          type="button"
          aria-label={controller.t('inspiration.close')}
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm xl:hidden"
          onClick={() => controller.setInspirationOpen(false)}
        />
      )}
      <ImageStudioSettingsPanel {...controller.settingsPanelProps} />

      <main className="flex min-w-0 flex-1 flex-col">
        <ImageStudioWorkspaceHeader {...controller.headerProps} />

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4">
              <ImageStudioResultsPanel {...controller.resultsPanelProps} />

              <ImageStudioReferencesPanel {...controller.referencesPanelProps} />

              <ImageStudioPromptPanel {...controller.promptPanelProps} />
            </div>
          </div>

          <ImageStudioInspirationAside
            open={controller.inspirationOpen}
            panelProps={controller.inspirationPanelProps}
          />
        </div>
      </main>

      <input
        ref={controller.fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => void controller.handleUpload(e.target.files)}
      />
      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex size-11 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-accent xl:hidden"
        onClick={controller.openUploadDialog}
        title={controller.t('prompt.uploadRef')}
      >
        <Upload className="size-4" />
      </button>
      {controller.previewElement}
      {controller.annotationTarget && (
        <ImageAnnotationOverlay
          target={controller.annotationTarget}
          onClose={() => controller.setAnnotationTarget(null)}
          onUse={controller.handleUseAnnotation}
        />
      )}
    </div>
  );
}
