'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLocalVideoProject, useVideoProjectStore, type VideoClip } from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
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
import { useVideoClipsEstimate } from './workbench/useSelectedClipEstimate';
import { useVideoWorkbenchEstimateController } from './workbench/useVideoWorkbenchEstimateController';
import { useVideoWorkbenchMaterialController } from './workbench/useVideoWorkbenchMaterialController';
import { useVideoWorkbenchMaterials } from './workbench/useVideoWorkbenchMaterials';
import { useVideoWorkbenchModels } from './workbench/useVideoWorkbenchModels';
import { useVideoWorkbenchTemplates } from './workbench/useVideoWorkbenchTemplates';
import { schemaParamsToVideoClipParams } from './workbench/schema-params-mapping';
import { buildVideoInitialDraftParams, type VideoInitialDraft } from './workbench/initial-draft';
import { buildReusableVideoProject } from './workbench/video-history-reuse';
import { VideoWorkbenchWorkspaceView } from './workbench/VideoWorkbenchWorkspaceView';

function normalizeModelHint(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findVideoModelByHint(models: { id: string; name?: string | null; model?: string | null; provider?: string | null }[], hint: string | null | undefined) {
  const normalizedHint = normalizeModelHint(hint);
  if (!normalizedHint) return null;
  return models.find((model) =>
    [
      model.id,
      model.name,
      model.model,
      `${model.provider ?? ''} ${model.model ?? ''}`,
    ].some((candidate) => normalizeModelHint(candidate).includes(normalizedHint)),
  ) ?? null;
}

export function VideoWorkbenchWorkspace({
  initialProjectId = null,
  initialTemplateId = null,
  initialWorkflowTemplateId = null,
  initialModelId = null,
  initialDraft,
  onInitialDraftCleared,
}: {
  initialProjectId?: string | null;
  initialTemplateId?: string | null;
  initialWorkflowTemplateId?: string | null;
  initialModelId?: string | null;
  initialDraft?: VideoInitialDraft;
  onInitialDraftCleared?: () => void;
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
  const [historyDetailProjectId, setHistoryDetailProjectId] = useState<string | null>(null);
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
    videoTaskModels,
  } = useVideoWorkbenchModels();
  const [promptOptimizing, setPromptOptimizing] = useState(false);
  const [storyboardPrompt, setStoryboardPrompt] = useState('');
  const [storyboardToolPrompt, setStoryboardToolPrompt] = useState('');
  const [storyboardToolClipCount, setStoryboardToolClipCount] = useState(5);
  const [storyboardToolLoading, setStoryboardToolLoading] = useState(false);
  const [appliedInitialTemplateId, setAppliedInitialTemplateId] = useState<string | null>(null);
  const creatingInitialClipRef = useRef(false);
  const draftAppliedRef = useRef(false);

  useEffect(() => {
    if (initialProjectId) {
      void loadProject(initialProjectId);
      return;
    }
    void loadOrCreateStandaloneProject();
  }, [initialProjectId, loadOrCreateStandaloneProject, loadProject]);

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

  // Apply the public-generator draft exactly once. Gated on `project && selectedClip`
  // so the initial clip (created async) exists and the seeding effect above has run
  // first in the same commit; our functional updates then merge on top of the seed.
  useEffect(() => {
    if (draftAppliedRef.current) return;
    if (!initialDraft || Object.keys(initialDraft).length === 0) return;
    if (!project || !selectedClip) return;
    const hasVideoModelChoices = videoModels.length > 0;
    const hasSelectedVideoModel = typeof globalVideoParams.modelConfigId === 'string' && globalVideoParams.modelConfigId;
    if (hasVideoModelChoices && !hasSelectedVideoModel) return;

    draftAppliedRef.current = true;
    const mode =
      initialDraft.mode && isVideoWorkspaceMode(initialDraft.mode)
        ? initialDraft.mode
        : null;
    const draftParams = buildVideoInitialDraftParams(initialDraft, mode);
    setGlobalVideoParams((p) => ({ ...p, ...draftParams }));
    if (mode) setWorkspaceMode(mode);
    const targetMode = mode ?? workspaceMode;
    const nextClipParams = { ...clipParams(selectedClip), ...draftParams };
    const updateData =
      initialDraft.prompt && targetMode !== 'storyboard'
        ? { prompt: initialDraft.prompt, params: nextClipParams }
        : { params: nextClipParams };

    if (initialDraft.prompt && targetMode === 'storyboard') {
      setStoryboardPrompt(initialDraft.prompt);
    }
    void updateClip(selectedClip.id, updateData)
      .then(async () => {
        const materials = initialDraft.materials ?? [];
        for (const material of materials) {
          await addMaterial(selectedClip.id, {
            role: 'reference_image',
            sourceType: material.sourceType ?? 'upload',
            sourceId: material.sourceId,
            url: material.url,
            name: material.name,
            metadata: { source: 'public-generator' },
          });
        }
      })
      .finally(() => onInitialDraftCleared?.());
  }, [
    addMaterial,
    globalVideoParams.modelConfigId,
    initialDraft,
    onInitialDraftCleared,
    project,
    selectedClip,
    updateClip,
    videoModels.length,
    workspaceMode,
  ]);

  useEffect(() => {
    if (inspirationOpen && inspirationTab === 'history') {
      void loadProjects();
    }
  }, [inspirationOpen, inspirationTab, loadProjects]);

  const selectedLatestGeneration = useMemo(
    () => resolveLatestCompletedVideoGeneration(selectedClip),
    [selectedClip],
  );
  const generatableClips = useMemo(
    () =>
      clips.filter(
        (clip) =>
          clip.status === 'pending' &&
          (canGenerateClip(clip) ||
            (workspaceMode === 'storyboard' && storyboardPrompt.trim())),
      ),
    [clips, storyboardPrompt, workspaceMode],
  );
  const isGeneratingProject = generatingClipIds.length > 0;
  const canGenerateProject = generatableClips.length > 0 && !isGeneratingProject;
  const {
    estimatedCost: projectEstimatedCost,
    loading: projectEstimateLoading,
  } = useVideoClipsEstimate({
    clips: generatableClips,
    canGenerate: canGenerateProject,
    videoModels,
  });

  const handleCreateBlankProject = useCallback(() => {
    replaceDraftProject(createLocalVideoProject());
    setHistoryDetailProjectId(null);
    setInspirationOpen(false);
    setStoryboardToolsOpen(false);
  }, [replaceDraftProject]);

  const handleOpenHistoryProject = useCallback(
    (projectId: string) => {
      setHistoryDetailProjectId(projectId);
      setInspirationOpen(false);
      setParamsOpen(false);
      setStoryboardToolsOpen(false);
    },
    [],
  );

  const handleReuseHistoryProject = useCallback(
    (projectId: string) => {
      const source = projects.find((item) => item.id === projectId);
      if (!source) return;
      const sourceClips = [...(source.clips ?? [])].sort((a, b) => a.order - b.order);
      replaceDraftProject(buildReusableVideoProject(source));
      const firstParams = sourceClips[0]?.params ?? DEFAULT_VIDEO_PARAMS;
      setGlobalVideoParams({ ...DEFAULT_VIDEO_PARAMS, ...firstParams });
      setStoryboardPrompt(resolveStoryboardPrompt(sourceClips));
      setWorkspaceMode('storyboard');
      setHistoryDetailProjectId(null);
      setInspirationOpen(false);
      setStoryboardToolsOpen(false);
    },
    [projects, replaceDraftProject],
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
    const preferredModel = findVideoModelByHint(videoModels, initialModelId) ?? videoModels[0];
    const fallbackId = preferredModel?.id;
    if (!fallbackId || fallbackId === currentId) return;
    void handleVideoModelChange(fallbackId);
  }, [videoModels, globalVideoParams.modelConfigId, handleVideoModelChange, initialModelId]);

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
    async (_clip: VideoClip) => {
      if (isGeneratingProject) return;
      await syncStoryboardPromptToClips();
      const targetClipIds = clips
        .filter(
          (item) =>
            item.status === 'pending' &&
            (canGenerateClip(item) ||
              (workspaceMode === 'storyboard' && storyboardPrompt.trim())),
        )
        .map((item) => item.id);
      if (targetClipIds.length === 0) return;
      void estimateVideoClips({ mode: 'batch', clipIds: targetClipIds });
    },
    [clips, estimateVideoClips, isGeneratingProject, storyboardPrompt, syncStoryboardPromptToClips, workspaceMode],
  );

  const handleApplyTemplate = useCallback(async (template: WorkbenchVideoTemplate) => {
    setApplyingTemplateId(template.templateKey);
    try {
      setInspirationOpen(false);
      setHistoryDetailProjectId(null);
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
  const historyDetailProject = useMemo(
    () => projects.find((item) => item.id === historyDetailProjectId) ?? null,
    [historyDetailProjectId, projects],
  );

  const currentVideoModelId =
    typeof globalVideoParams.modelConfigId === 'string' ? globalVideoParams.modelConfigId : '';
  const selectedVideoTaskModel = videoTaskModels.find(
    (model) => model.modelConfigId === currentVideoModelId,
  );

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
      clips={clips}
      selectedClip={selectedClip}
      projectId={project?.id ?? ''}
      generatingCount={generatingClipIds.length}
      generatingClipIds={generatingClipIds}
      storyboardPrompt={storyboardPrompt}
      onModeChange={(mode) => void handleModeChange(mode)}
      paramsSchema={selectedVideoTaskModel?.paramsSchema as unknown as ParamsSchema | undefined}
      pricingSchema={selectedVideoTaskModel?.pricingSchema as unknown as PricingSchema | undefined}
      pricingContext={{
        multiplier: selectedVideoTaskModel?.multiplier ?? 1,
        discountFactor: selectedVideoTaskModel?.discountFactor ?? 1,
      }}
      // 显式的 schema<->clip-params 映射层（task 7 review CRITICAL 1）：seconds
      // 改名到 duration，resolution/ratio 键值本就一致原样透传。见
      // schema-params-mapping.ts 顶部注释里的 source of truth。
      onParamsChange={(params) => void updateSelectedClipParams(schemaParamsToVideoClipParams(params))}
      clipParams={globalVideoParams}
      hasClip={Boolean(selectedClip)}
      onClipParamChange={(partial, removeKeys) => void updateSelectedClipParams(partial, removeKeys)}
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
      videoModelId={currentVideoModelId}
      videoModels={videoModels}
      videoModelsLoading={videoModelsLoading}
      estimatedCost={projectEstimatedCost}
      estimatingCost={projectEstimateLoading}
      canGenerate={canGenerateProject}
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
      historyDetailProject={historyDetailProject}
      onHistoryDetailBack={() => setHistoryDetailProjectId(null)}
      onSelectHistoryProject={(projectId) => void handleOpenHistoryProject(projectId)}
      onReuseHistoryProject={(projectId) => void handleReuseHistoryProject(projectId)}
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
