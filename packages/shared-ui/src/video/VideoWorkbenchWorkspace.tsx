'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createLocalVideoProject,
  useVideoProjectStore,
  type VideoClip,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_VIDEO_PARAMS,
  buildTemplateDraft,
  canGenerateClip,
  clipParams,
  isVideoWorkspaceMode,
  resolveStoryboardPrompt,
  resolveLatestCompletedVideoGeneration,
  type VideoInspirationTab,
  type VideoWorkspaceMode,
  type WorkbenchVideoTemplate,
} from './workbench/constants';
import { useVideoWorkbenchClipController } from './workbench/useVideoWorkbenchClipController';
import { useVideoWorkbenchDirectorController } from './workbench/useVideoWorkbenchDirectorController';
import { useSelectedClipEstimate } from './workbench/useSelectedClipEstimate';
import { useVideoWorkbenchEstimateController } from './workbench/useVideoWorkbenchEstimateController';
import { useVideoWorkbenchMaterialController } from './workbench/useVideoWorkbenchMaterialController';
import { useVideoWorkbenchMaterials } from './workbench/useVideoWorkbenchMaterials';
import { useVideoWorkbenchModels } from './workbench/useVideoWorkbenchModels';
import { useVideoWorkbenchTemplates } from './workbench/useVideoWorkbenchTemplates';
import { VideoWorkbenchWorkspaceView } from './workbench/VideoWorkbenchWorkspaceView';

export function VideoWorkbenchWorkspace({
  initialTemplateId = null,
  initialWorkflowTemplateId = null,
}: {
  initialTemplateId?: string | null;
  initialWorkflowTemplateId?: string | null;
} = {}) {
  const {
    project,
    projects,
    loading,
    selectedClipId,
    loadProject,
    loadProjects,
    loadOrCreateStandaloneProject,
    persistDraftProject,
    replaceDraftProject,
    selectClip,
    addClip,
    updateClip,
    deleteClip,
    addMaterial,
    removeMaterial,
    generateClip,
    generateAll,
    generatingClipIds,
    lastError,
    lastErrorCode,
    clearError,
  } = useVideoProjectStore();
  const t = useTranslations('videoWorkbench.workspace');
  const tToast = useTranslations('videoWorkbench.toasts');
  const tMaterialTargets = useTranslations('videoWorkbench.materialTargets');
  const materialTargetMessages = useMemo(
    () => ({
      firstFrame: tMaterialTargets('firstFrame'),
      lastFrame: tMaterialTargets('lastFrame'),
      referenceImage: tMaterialTargets('referenceImage'),
      referenceVideo: tMaterialTargets('referenceVideo'),
      referenceAudio: tMaterialTargets('referenceAudio'),
    }),
    [tMaterialTargets],
  );
  const clipControllerMessages = useMemo(
    () => ({
      insufficientDuration: tToast('insufficientDuration'),
      storyboardClipTitle: (order: number) => t('storyboardClipTitle', { order }),
    }),
    [t, tToast],
  );
  const directorControllerMessages = useMemo(
    () => ({
      directorDefaultFallback: tToast('directorDefaultFallback'),
      directorRequestFailed: tToast('directorRequestFailed'),
      emptyStoryboardPrompt: tToast('emptyStoryboardPrompt'),
      emptyVideoPrompt: tToast('emptyVideoPrompt'),
      storyboardPromptOptimized: tToast('storyboardPromptOptimized'),
      videoPromptOptimized: tToast('videoPromptOptimized'),
      storyboardPromptOptimizeFailed: tToast('storyboardPromptOptimizeFailed'),
      videoPromptOptimizeFailed: tToast('videoPromptOptimizeFailed'),
      emptyStoryboardIdea: tToast('emptyStoryboardIdea'),
      storyboardGeneratedSuccess: tToast('storyboardGeneratedSuccess'),
      storyboardGenerateFailed: tToast('storyboardGenerateFailed'),
      storyboardGenerated: (count: number) => tToast('storyboardGenerated', { count }),
      shotTitleFallback: (order: number) => t('shotTitleFallback', { order }),
    }),
    [t, tToast],
  );
  const materialControllerMessages = useMemo(
    () => ({
      selectClipFirst: tToast('selectClipFirst'),
      materialUseFailed: tToast('materialUseFailed'),
      noFramesToSwap: tToast('noFramesToSwap'),
      swappedFrames: tToast('swappedFrames'),
      swapFramesFailed: tToast('swapFramesFailed'),
      defaultMaterialTitle: tToast('defaultMaterialTitle'),
      addedToMaterials: tToast('addedToMaterials'),
      addToMaterialsFailed: tToast('addToMaterialsFailed'),
      placedInto: (target: string) => tToast('placedInto', { target }),
    }),
    [tToast],
  );
  const [paramsOpen, setParamsOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationTab, setInspirationTab] = useState<VideoInspirationTab>('history');
  const [storyboardToolsOpen, setStoryboardToolsOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<VideoWorkspaceMode>('storyboard');
  const [globalVideoParams, setGlobalVideoParams] = useState<Record<string, unknown>>(
    () => ({ ...DEFAULT_VIDEO_PARAMS }),
  );
  const globalParamsSeededRef = useRef<string | null>(null);
  const {
    templates,
    templatesLoading,
    templateSearch,
    setTemplateSearch,
    templateCategory,
    setTemplateCategory,
    templateCategories,
    filteredTemplates,
  } = useVideoWorkbenchTemplates({ initialTemplateId, initialWorkflowTemplateId });
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const {
    materials,
    materialsLoading,
    materialSearch,
    setMaterialSearch,
    materialType,
    setMaterialType,
    materialTarget,
    setMaterialTarget,
  } = useVideoWorkbenchMaterials({ open: inspirationOpen, tab: inspirationTab });
  const {
    directorModels,
    directorModelId,
    setDirectorModelId,
    directorModelsLoading,
    videoModels,
    videoModelsLoading,
  } = useVideoWorkbenchModels();
  const [promptOptimizing, setPromptOptimizing] = useState(false);
  const [storyboardPrompt, setStoryboardPrompt] = useState('');
  const [storyboardToolPrompt, setStoryboardToolPrompt] = useState('');
  const [storyboardToolClipCount, setStoryboardToolClipCount] = useState(5);
  const [storyboardToolLoading, setStoryboardToolLoading] = useState(false);
  const [appliedInitialTemplateId, setAppliedInitialTemplateId] = useState<string | null>(null);
  const creatingInitialClipRef = useRef(false);

  useEffect(() => {
    void loadOrCreateStandaloneProject();
  }, [loadOrCreateStandaloneProject]);

  const clips = project?.clips ?? [];
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? clips[0] ?? null;

  useEffect(() => {
    if (!project || clips.length > 0 || creatingInitialClipRef.current) return;
    creatingInitialClipRef.current = true;
    addClip({
      title: t('initialClipTitle'),
      prompt: '',
      params: { ...DEFAULT_VIDEO_PARAMS, generationMode: workspaceMode },
      chainFromPrev: false,
    }).finally(() => {
      creatingInitialClipRef.current = false;
    });
  }, [addClip, clips.length, project, workspaceMode, t]);

  useEffect(() => {
    const projectKey = project?.id ?? null;
    if (globalParamsSeededRef.current === projectKey) return;
    if (!projectKey) {
      globalParamsSeededRef.current = null;
      return;
    }
    const seedClip = clips[0];
    if (!seedClip) {
      setStoryboardPrompt('');
      return;
    }
    const seedParams = clipParams(seedClip);
    const seededStoryboardPrompt = resolveStoryboardPrompt(clips);
    setStoryboardPrompt(seededStoryboardPrompt);
    setGlobalVideoParams({
      ...DEFAULT_VIDEO_PARAMS,
      ...seedParams,
      ...(seededStoryboardPrompt ? { storyboardPrompt: seededStoryboardPrompt } : {}),
    });
    const seededMode = seedParams.generationMode;
    if (isVideoWorkspaceMode(seededMode)) setWorkspaceMode(seededMode);
    globalParamsSeededRef.current = projectKey;
  }, [project?.id, clips]);

  useEffect(() => {
    if (inspirationOpen && inspirationTab === 'history') {
      void loadProjects();
    }
  }, [inspirationOpen, inspirationTab, loadProjects]);

  const selectedLatestGeneration = useMemo(
    () => resolveLatestCompletedVideoGeneration(selectedClip),
    [selectedClip],
  );
  const selectedClipCanGenerate = useMemo(
    () =>
      Boolean(
        selectedClip &&
        (canGenerateClip(selectedClip) ||
          (workspaceMode === 'storyboard' && storyboardPrompt.trim())),
      ),
    [selectedClip, storyboardPrompt, workspaceMode],
  );
  const {
    estimate: selectedClipEstimate,
    loading: selectedClipEstimateLoading,
  } = useSelectedClipEstimate({
    selectedClip,
    canGenerate: selectedClipCanGenerate,
    videoModels,
  });

  const handleCreateBlankProject = useCallback(() => {
    replaceDraftProject(createLocalVideoProject());
    setInspirationOpen(false);
    setStoryboardToolsOpen(false);
  }, [replaceDraftProject]);

  const handleOpenHistoryProject = useCallback(
    async (projectId: string) => {
      await loadProject(projectId);
      setInspirationOpen(false);
      setStoryboardToolsOpen(false);
    },
    [loadProject],
  );

  const {
    updateSelectedClipParams,
    handleStoryboardPromptChange,
    syncStoryboardPromptToClips,
    handleModeChange,
    handleVideoModelChange,
    handleAddStoryboardClip,
  } = useVideoWorkbenchClipController({
    clips,
    videoModels,
    workspaceMode,
    globalVideoParams,
    storyboardPrompt,
    setGlobalVideoParams,
    setStoryboardPrompt,
    setWorkspaceMode,
    addClip,
    updateClip,
    messages: clipControllerMessages,
  });

  useEffect(() => {
    if (videoModels.length === 0) return;
    const currentId = typeof globalVideoParams.modelConfigId === 'string' ? globalVideoParams.modelConfigId : '';
    const stillExists = currentId && videoModels.some((model) => model.id === currentId);
    if (stillExists) return;
    const fallbackId = videoModels[0]?.id;
    if (!fallbackId || fallbackId === currentId) return;
    void handleVideoModelChange(fallbackId);
  }, [videoModels, globalVideoParams.modelConfigId, handleVideoModelChange]);

  const {
    openStoryboardTool,
    handleOptimizeSelectedPrompt,
    handleGenerateStoryboardFromTool,
  } = useVideoWorkbenchDirectorController({
    project,
    clips,
    selectedClip,
    workspaceMode,
    globalVideoParams,
    storyboardPrompt,
    storyboardToolPrompt,
    storyboardToolClipCount,
    storyboardToolLoading,
    promptOptimizing,
    directorModelId,
    persistDraftProject,
    loadProject,
    deleteClip,
    setWorkspaceMode,
    setStoryboardPrompt,
    setGlobalVideoParams,
    setStoryboardToolPrompt,
    setStoryboardToolsOpen,
    setStoryboardToolLoading,
    setPromptOptimizing,
    messages: directorControllerMessages,
  });

  const {
    handleUseMaterialAsset,
    handleSwapFirstLastFrame,
    handleAddSelectedVideoToMaterial,
  } = useVideoWorkbenchMaterialController({
    selectedClip,
    selectedLatestGeneration,
    projectTitle: project?.title,
    materialTarget,
    materialTargetMessages,
    setMaterialTarget,
    addMaterial,
    removeMaterial,
    messages: materialControllerMessages,
  });

  const {
    estimateOpen,
    estimateLoading,
    estimateError,
    clipEstimates,
    accountBalance,
    handleEstimateOpenChange,
    estimateVideoClips,
    handleConfirmVideoGenerate,
  } = useVideoWorkbenchEstimateController({
    projectId: project?.id ?? null,
    generatingCount: generatingClipIds.length,
    clips,
    videoModels,
    estimateFailedMessage: tToast('estimateFailed'),
    syncStoryboardPromptToClips,
    generateClip,
    generateAll,
  });

  const handleRequestClipGenerate = useCallback(
    async (clip: VideoClip) => {
      await syncStoryboardPromptToClips();
      void estimateVideoClips({ mode: 'single', clipId: clip.id });
    },
    [estimateVideoClips, syncStoryboardPromptToClips],
  );

  const handleApplyTemplate = useCallback(async (template: WorkbenchVideoTemplate) => {
    setApplyingTemplateId(template.templateKey);
    try {
      setInspirationOpen(false);
      replaceDraftProject(buildTemplateDraft(template));
      setWorkspaceMode(template.templateKind === 'workflow' ? 'storyboard' : 'standard');
    } finally {
      setApplyingTemplateId(null);
    }
  }, [replaceDraftProject]);

  useEffect(() => {
    const targetId = initialWorkflowTemplateId ?? initialTemplateId;
    if (!targetId || templatesLoading || appliedInitialTemplateId === targetId) return;
    const target = templates.find((template) => {
      if (initialWorkflowTemplateId) {
        return template.templateKind === 'workflow' && template.id === initialWorkflowTemplateId;
      }
      return template.templateKind === 'standard' && template.id === initialTemplateId;
    });
    if (!target) return;
    setAppliedInitialTemplateId(targetId);
    void handleApplyTemplate(target);
  }, [
    appliedInitialTemplateId,
    initialTemplateId,
    initialWorkflowTemplateId,
    templates,
    templatesLoading,
    handleApplyTemplate,
  ]);

  return (
    <VideoWorkbenchWorkspaceView
      loading={loading && !project}
      title={project?.title}
      lastError={lastError}
      lastErrorCode={lastErrorCode}
      labels={{
        loading: t('loading'),
        closeParamsAria: t('closeParamsAria'),
        headerTitle: t('headerTitle'),
        headerSubtitle: t('headerSubtitle'),
        paramsButton: t('paramsButton'),
        newButton: t('newButton'),
        inspirationButton: t('inspirationButton'),
      }}
      paramsOpen={paramsOpen}
      onParamsOpenChange={setParamsOpen}
      onCreateBlankProject={handleCreateBlankProject}
      inspirationOpen={inspirationOpen}
      onInspirationOpenChange={setInspirationOpen}
      mode={workspaceMode}
      params={globalVideoParams}
      clips={clips}
      selectedClip={selectedClip}
      projectId={project?.id ?? ''}
      generatingCount={generatingClipIds.length}
      storyboardPrompt={storyboardPrompt}
      onModeChange={(mode) => void handleModeChange(mode)}
      onParamChange={(partial, removeKeys) => void updateSelectedClipParams(partial, removeKeys)}
      onSelectClip={selectClip}
      onOpenStoryboardTools={() => openStoryboardTool(storyboardPrompt)}
      onAddStoryboardClip={(duration) => void handleAddStoryboardClip(duration)}
      onStoryboardPromptChange={handleStoryboardPromptChange}
      onStoryboardPromptBlur={() => void syncStoryboardPromptToClips()}
      onClipPromptChange={(clip, prompt) => void updateClip(clip.id, { prompt })}
      onClipTitleChange={(clip, title) => void updateClip(clip.id, { title })}
      onClipDurationChange={(clip, duration) =>
        void updateClip(clip.id, { params: { ...clipParams(clip), duration } })
      }
      onDeleteClip={(clip) => void deleteClip(clip.id)}
      onOptimizePrompt={() => void handleOptimizeSelectedPrompt()}
      optimizingPrompt={promptOptimizing}
      onSwapFirstLastFrame={() => void handleSwapFirstLastFrame()}
      textModelId={directorModelId}
      textModels={directorModels}
      textModelsLoading={directorModelsLoading}
      videoModelId={typeof globalVideoParams.modelConfigId === 'string' ? globalVideoParams.modelConfigId : ''}
      videoModels={videoModels}
      videoModelsLoading={videoModelsLoading}
      estimatedCost={selectedClipEstimate?.estimatedCost ?? null}
      estimatingCost={selectedClipEstimateLoading}
      canGenerate={selectedClipCanGenerate}
      onTextModelChange={setDirectorModelId}
      onVideoModelChange={(modelId) => void handleVideoModelChange(modelId)}
      onGenerateClip={(clip) => void handleRequestClipGenerate(clip)}
      onAddSelectedVideoToMaterial={() => void handleAddSelectedVideoToMaterial()}
      inspirationTab={inspirationTab}
      onInspirationTabChange={setInspirationTab}
      templates={filteredTemplates}
      templateCategories={templateCategories}
      templatesLoading={templatesLoading}
      templateSearch={templateSearch}
      templateCategory={templateCategory}
      applyingTemplateId={applyingTemplateId}
      onTemplateSearchChange={setTemplateSearch}
      onTemplateCategoryChange={setTemplateCategory}
      onApplyTemplate={(template) => void handleApplyTemplate(template)}
      historyProjects={projects}
      onSelectHistoryProject={(projectId) => void handleOpenHistoryProject(projectId)}
      materials={materials}
      materialsLoading={materialsLoading}
      materialSearch={materialSearch}
      materialType={materialType}
      materialTarget={materialTarget}
      onMaterialSearchChange={setMaterialSearch}
      onMaterialTypeChange={setMaterialType}
      onMaterialTargetChange={setMaterialTarget}
      onUseMaterial={(asset) => void handleUseMaterialAsset(asset)}
      storyboardToolsOpen={storyboardToolsOpen}
      onStoryboardToolsOpenChange={setStoryboardToolsOpen}
      storyboardToolPrompt={storyboardToolPrompt}
      onStoryboardToolPromptChange={setStoryboardToolPrompt}
      storyboardToolClipCount={storyboardToolClipCount}
      onStoryboardToolClipCountChange={setStoryboardToolClipCount}
      storyboardToolLoading={storyboardToolLoading}
      onGenerateStoryboardFromTool={() => void handleGenerateStoryboardFromTool()}
      estimateOpen={estimateOpen}
      onEstimateOpenChange={handleEstimateOpenChange}
      estimateLoading={estimateLoading}
      estimateError={estimateError}
      clipEstimates={clipEstimates}
      accountBalance={accountBalance}
      onConfirmVideoGenerate={() => void handleConfirmVideoGenerate()}
      onDismissError={clearError}
    />
  );
}
