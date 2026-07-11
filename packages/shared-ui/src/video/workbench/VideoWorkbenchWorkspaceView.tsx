'use client';

import {
  FolderOpen,
  Loader2,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import type {
  MaterialAsset,
  MaterialAssetType,
  ModelConfigItem,
  VideoClip,
  VideoProject,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';
import { VideoParameterPanel } from './panels/VideoParameterPanel';
import { VideoWorkspaceConfigPanel } from './panels/VideoWorkspaceConfigPanel';
import { VideoProductPanel } from './panels/VideoProductPanel';
import { StoryboardToolsDialog } from './dialogs/StoryboardToolsDialog';
import { VideoInspirationSheet } from './dialogs/VideoInspirationSheet';
import { VideoEstimateDialog } from './dialogs/VideoEstimateDialog';
import { VideoHistoryDetailWorkspace } from './VideoHistoryDetailWorkspace';
import {
  isVideoMembershipError,
  VideoMembershipUpgradeAlert,
} from '../VideoMembershipUpgradeAlert';
import {
  VIDEO_MODE_VALUES,
  type VideoClipEstimate,
  type VideoInspirationTab,
  type VideoMaterialTarget,
  type VideoWorkspaceMode,
  type WorkbenchVideoTemplate,
} from './constants';

interface VideoWorkbenchWorkspaceViewLabels {
  loading: string;
  closeParamsAria: string;
  headerTitle: string;
  headerSubtitle: string;
  paramsButton: string;
  newButton: string;
  inspirationButton: string;
}

interface VideoWorkbenchWorkspaceViewProps {
  loading: boolean;
  title: string | null | undefined;
  lastError: string | null | undefined;
  lastErrorCode: string | null | undefined;
  labels: VideoWorkbenchWorkspaceViewLabels;
  paramsOpen: boolean;
  onParamsOpenChange: (open: boolean) => void;
  onCreateBlankProject: () => void;
  inspirationOpen: boolean;
  onInspirationOpenChange: (open: boolean) => void;
  mode: VideoWorkspaceMode;
  clips: VideoClip[];
  selectedClip: VideoClip | null;
  projectId: string;
  generatingCount: number;
  generatingClipIds: string[];
  storyboardPrompt: string;
  onModeChange: (mode: VideoWorkspaceMode) => void;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  onParamsChange: (params: Record<string, unknown>) => void;
  /** 全局视频参数（非计价参数的音频开关/seed 也存在这个包里，见下方保留区块）。 */
  clipParams: Record<string, unknown>;
  hasClip: boolean;
  onClipParamChange: (partial: Record<string, unknown>, removeKeys?: string[]) => void;
  onSelectClip: (clipId: string | null) => void;
  onOpenStoryboardTools: () => void;
  onAddStoryboardClip: (duration: number) => void;
  onStoryboardPromptChange: (prompt: string) => void;
  onStoryboardPromptBlur: () => void;
  onClipPromptChange: (clip: VideoClip, prompt: string) => void;
  onClipTitleChange: (clip: VideoClip, title: string) => void;
  onClipDurationChange: (clip: VideoClip, duration: number) => void;
  onDeleteClip: (clip: VideoClip) => void;
  onOptimizePrompt: () => void;
  optimizingPrompt: boolean;
  onSwapFirstLastFrame: () => void;
  textModelId: string | null;
  textModels: ModelConfigItem[];
  textModelsLoading: boolean;
  videoModelId: string;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  canGenerate: boolean;
  onTextModelChange: (modelId: string | null) => void;
  onVideoModelChange: (modelId: string) => void;
  onGenerateClip: (clip: VideoClip) => void;
  onAddSelectedVideoToMaterial: () => void;
  inspirationTab: VideoInspirationTab;
  onInspirationTabChange: (tab: VideoInspirationTab) => void;
  templates: WorkbenchVideoTemplate[];
  templateCategories: string[];
  templatesLoading: boolean;
  templateSearch: string;
  templateCategory: string;
  applyingTemplateId: string | null;
  onTemplateSearchChange: (search: string) => void;
  onTemplateCategoryChange: (category: string) => void;
  onApplyTemplate: (template: WorkbenchVideoTemplate) => void;
  historyProjects: VideoProject[];
  historyDetailProject: VideoProject | null;
  onHistoryDetailBack: () => void;
  onSelectHistoryProject: (projectId: string) => void;
  onReuseHistoryProject: (projectId: string) => void;
  materials: MaterialAsset[];
  materialsLoading: boolean;
  materialSearch: string;
  materialType: MaterialAssetType | 'all';
  materialTarget: VideoMaterialTarget;
  onMaterialSearchChange: (search: string) => void;
  onMaterialTypeChange: (type: MaterialAssetType | 'all') => void;
  onMaterialTargetChange: (target: VideoMaterialTarget) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
  storyboardToolsOpen: boolean;
  onStoryboardToolsOpenChange: (open: boolean) => void;
  storyboardToolPrompt: string;
  onStoryboardToolPromptChange: (prompt: string) => void;
  storyboardToolClipCount: number;
  onStoryboardToolClipCountChange: (count: number) => void;
  storyboardToolLoading: boolean;
  onGenerateStoryboardFromTool: () => void;
  estimateOpen: boolean;
  onEstimateOpenChange: (open: boolean) => void;
  estimateLoading: boolean;
  estimateError: string | null;
  clipEstimates: VideoClipEstimate[];
  accountBalance: number | null;
  onConfirmVideoGenerate: () => void;
  onDismissError: () => void;
}

export function VideoWorkbenchWorkspaceView({
  loading,
  title,
  lastError,
  lastErrorCode,
  labels,
  paramsOpen,
  onParamsOpenChange,
  onCreateBlankProject,
  inspirationOpen,
  onInspirationOpenChange,
  mode,
  clips,
  selectedClip,
  projectId,
  generatingCount,
  generatingClipIds,
  storyboardPrompt,
  onModeChange,
  paramsSchema,
  pricingSchema,
  pricingContext,
  onParamsChange,
  clipParams,
  hasClip,
  onClipParamChange,
  onSelectClip,
  onOpenStoryboardTools,
  onAddStoryboardClip,
  onStoryboardPromptChange,
  onStoryboardPromptBlur,
  onClipPromptChange,
  onClipTitleChange,
  onClipDurationChange,
  onDeleteClip,
  onOptimizePrompt,
  optimizingPrompt,
  onSwapFirstLastFrame,
  textModelId,
  textModels,
  textModelsLoading,
  videoModelId,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  canGenerate,
  onTextModelChange,
  onVideoModelChange,
  onGenerateClip,
  onAddSelectedVideoToMaterial,
  inspirationTab,
  onInspirationTabChange,
  templates,
  templateCategories,
  templatesLoading,
  templateSearch,
  templateCategory,
  applyingTemplateId,
  onTemplateSearchChange,
  onTemplateCategoryChange,
  onApplyTemplate,
  historyProjects,
  historyDetailProject,
  onHistoryDetailBack,
  onSelectHistoryProject,
  onReuseHistoryProject,
  materials,
  materialsLoading,
  materialSearch,
  materialType,
  materialTarget,
  onMaterialSearchChange,
  onMaterialTypeChange,
  onMaterialTargetChange,
  onUseMaterial,
  storyboardToolsOpen,
  onStoryboardToolsOpenChange,
  storyboardToolPrompt,
  onStoryboardToolPromptChange,
  storyboardToolClipCount,
  onStoryboardToolClipCountChange,
  storyboardToolLoading,
  onGenerateStoryboardFromTool,
  estimateOpen,
  onEstimateOpenChange,
  estimateLoading,
  estimateError,
  clipEstimates,
  accountBalance,
  onConfirmVideoGenerate,
  onDismissError,
}: VideoWorkbenchWorkspaceViewProps) {
  const tModes = useTranslations('videoWorkbench.modes');
  const modeOptions = VIDEO_MODE_VALUES.map((value) => ({
    value,
    label: tModes(`${value}.label`),
  }));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {labels.loading}
      </div>
    );
  }

  if (historyDetailProject) {
    return (
      <VideoHistoryDetailWorkspace
        project={historyDetailProject}
        onBack={onHistoryDetailBack}
        onReuse={onReuseHistoryProject}
      />
    );
  }

  return (
    <div className="flex h-full min-w-0 bg-background text-foreground">
      {paramsOpen && (
        <button
          type="button"
          aria-label={labels.closeParamsAria}
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm xl:hidden"
          onClick={() => onParamsOpenChange(false)}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{title ?? labels.headerTitle}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {labels.headerSubtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 xl:hidden" onClick={() => onParamsOpenChange(true)}>
              <PanelLeftOpen className="size-3.5" />
              <span className="hidden sm:inline">{labels.paramsButton}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onCreateBlankProject}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">{labels.newButton}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onInspirationOpenChange(true)}>
              <FolderOpen className="size-3.5" />
              <span className="hidden sm:inline">{labels.inspirationButton}</span>
            </Button>
          </div>
        </header>

        {/* mode（storyboard/first_last_frame/standard）不是计价参数，不属于
            paramsSchema——薄壳化后 VideoParameterPanel 不再渲染它，挪到这里保留
            切换入口（纯 UI 搬迁，mode/onModeChange 状态位置不变）。 */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition-colors',
                mode === option.value
                  ? 'border-primary bg-primary/8 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              onClick={() => onModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {lastError && (
          isVideoMembershipError(lastErrorCode) ? (
            <VideoMembershipUpgradeAlert message={lastError} onDismiss={onDismissError} />
          ) : (
            <div className="border-b border-border px-4 py-3">
              <div className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {lastError}
              </div>
            </div>
          )
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)]">
          <VideoParameterPanel
            open={paramsOpen}
            taskType="video_generation"
            modelConfigId={videoModelId || undefined}
            mode={mode}
            paramsSchema={paramsSchema}
            pricingSchema={pricingSchema}
            pricingContext={pricingContext}
            onClose={() => onParamsOpenChange(false)}
            onParamsChange={onParamsChange}
            clipParams={clipParams}
            hasClip={hasClip}
            onClipParamChange={onClipParamChange}
          />

          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4">
              <VideoProductPanel
                selectedClip={selectedClip}
                clips={clips}
                generatingClipIds={generatingClipIds}
                isGenerating={generatingCount > 0}
                onAddSelectedVideoToMaterial={onAddSelectedVideoToMaterial}
              />

              <VideoWorkspaceConfigPanel
                mode={mode}
                clips={clips}
                selectedClip={selectedClip}
                selectedClipId={selectedClip?.id ?? null}
                storyboardPrompt={storyboardPrompt}
                projectId={projectId}
                onSelectClip={onSelectClip}
                onOpenTools={onOpenStoryboardTools}
                onAddClip={onAddStoryboardClip}
                onStoryboardPromptChange={onStoryboardPromptChange}
                onStoryboardPromptBlur={onStoryboardPromptBlur}
                onPromptChange={onClipPromptChange}
                onTitleChange={onClipTitleChange}
                onClipDurationChange={onClipDurationChange}
                onDeleteClip={onDeleteClip}
                onOptimizePrompt={onOptimizePrompt}
                optimizingPrompt={optimizingPrompt}
                onSwapFirstLastFrame={onSwapFirstLastFrame}
                textModelId={textModelId}
                textModels={textModels}
                textModelsLoading={textModelsLoading}
                modelConfigId={videoModelId}
                videoModels={videoModels}
                videoModelsLoading={videoModelsLoading}
                estimatedCost={estimatedCost}
                estimatingCost={estimatingCost}
                canGenerate={canGenerate}
                onTextModelChange={onTextModelChange}
                onVideoModelChange={onVideoModelChange}
                onGenerate={onGenerateClip}
              />
            </div>
          </div>
        </div>
      </main>

      <VideoInspirationSheet
        open={inspirationOpen}
        onOpenChange={onInspirationOpenChange}
        tab={inspirationTab}
        onTabChange={onInspirationTabChange}
        templates={templates}
        categories={templateCategories}
        templatesLoading={templatesLoading}
        templateSearch={templateSearch}
        templateCategory={templateCategory}
        applyingId={applyingTemplateId}
        onTemplateSearchChange={onTemplateSearchChange}
        onTemplateCategoryChange={onTemplateCategoryChange}
        onApply={onApplyTemplate}
        historyProjects={historyProjects}
        onSelectProject={onSelectHistoryProject}
        onReuseProject={onReuseHistoryProject}
        materials={materials}
        materialsLoading={materialsLoading}
        materialSearch={materialSearch}
        materialType={materialType}
        materialTarget={materialTarget}
        onMaterialSearchChange={onMaterialSearchChange}
        onMaterialTypeChange={onMaterialTypeChange}
        onMaterialTargetChange={onMaterialTargetChange}
        onUseMaterial={onUseMaterial}
      />
      <StoryboardToolsDialog
        open={storyboardToolsOpen}
        onOpenChange={onStoryboardToolsOpenChange}
        prompt={storyboardToolPrompt}
        onPromptChange={onStoryboardToolPromptChange}
        clipCount={storyboardToolClipCount}
        onClipCountChange={onStoryboardToolClipCountChange}
        directorModels={textModels}
        directorModelId={textModelId}
        directorModelsLoading={textModelsLoading}
        onDirectorModelChange={onTextModelChange}
        loading={storyboardToolLoading}
        onGenerate={onGenerateStoryboardFromTool}
      />
      <VideoEstimateDialog
        open={estimateOpen}
        onOpenChange={onEstimateOpenChange}
        loading={estimateLoading}
        error={estimateError}
        estimates={clipEstimates}
        accountBalance={accountBalance}
        onConfirm={onConfirmVideoGenerate}
      />
    </div>
  );
}
