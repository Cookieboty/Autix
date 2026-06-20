'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type MaterialAsset,
  videoWorkbenchActions,
} from '@autix/shared-store';
import {
  createLocalVideoProject,
  useVideoProjectStore,
  type VideoClip,
} from '@autix/shared-store';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  buildTemplateDraft,
  canGenerateClip,
  canUseMaterialAsTarget,
  clipParams,
  defaultMaterialTargetForType,
  isVideoWorkspaceMode,
  extractStoryboardPromptFromDirectorContent,
  resolveStoryboardPrompt,
  roleLabel,
  resolveLatestCompletedVideoGeneration,
  suggestStoryboardClipDuration,
  type VideoInspirationTab,
  type VideoWorkspaceMode,
  type WorkbenchVideoTemplate,
} from './workbench/constants';
import { useSelectedClipEstimate } from './workbench/useSelectedClipEstimate';
import { useVideoWorkbenchEstimateController } from './workbench/useVideoWorkbenchEstimateController';
import { useVideoWorkbenchMaterials } from './workbench/useVideoWorkbenchMaterials';
import { useVideoWorkbenchModels } from './workbench/useVideoWorkbenchModels';
import { useVideoWorkbenchTemplates } from './workbench/useVideoWorkbenchTemplates';
import { VideoWorkbenchWorkspaceView } from './workbench/VideoWorkbenchWorkspaceView';
import {
  buildStoryboardGenerationMessage,
  buildStoryboardGenerationSharedParams,
  buildStoryboardPromptOptimizationMessage,
  buildVideoPromptOptimizationMessage,
  resolveStoryboardToolClipCount,
} from './workbench/director-messages';
import {
  buildStoryboardClipParams,
  resolveNextStoryboardClipDuration,
} from './workbench/storyboard-clip-helpers';

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

  const openStoryboardTool = useCallback(
    (promptSeed?: string) => {
      const seed =
        promptSeed?.trim() ||
        storyboardPrompt.trim() ||
        selectedClip?.prompt?.trim() ||
        '';
      setStoryboardToolPrompt(seed);
      setStoryboardToolsOpen(true);
    },
    [selectedClip?.prompt, storyboardPrompt],
  );

  const runDirectorMessage = useCallback(
    async (message: string, fallbackContent?: string, _displayContent = message) => {
      const safeFallback = fallbackContent ?? tToast('directorDefaultFallback');
      if (!message.trim() || !project) return null;
      try {
        const persisted = await persistDraftProject({ withConversation: true });
        const serverProject = persisted.project;
        const res = await videoWorkbenchActions.directorChat(serverProject.id, {
          message,
          modelId: directorModelId ?? undefined,
        });
        const content = res.content || safeFallback;
        await loadProject(serverProject.id);
        return {
          content,
          projectId: serverProject.id,
          clipIdMap: persisted.clipIdMap,
        };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : tToast('directorRequestFailed'));
        throw err;
      }
    },
    [directorModelId, loadProject, persistDraftProject, project, tToast],
  );

  const updateSelectedClipParams = useCallback(
    async (partial: Record<string, unknown>, removeKeys: string[] = []) => {
      setGlobalVideoParams((prev) => {
        const next = { ...prev };
        for (const key of removeKeys) delete next[key];
        return { ...next, ...partial };
      });
      if (clips.length === 0) return;
      await Promise.all(
        clips.map((clip) => {
          const nextParams = { ...clipParams(clip) };
          for (const key of removeKeys) delete nextParams[key];
          return updateClip(clip.id, { params: { ...nextParams, ...partial } });
        }),
      );
    },
    [clips, updateClip],
  );

  const handleStoryboardPromptChange = useCallback(
    (prompt: string) => {
      setStoryboardPrompt(prompt);
      const trimmedPrompt = prompt.trim();
      setGlobalVideoParams((prev) => {
        const next: Record<string, unknown> = { ...prev, generationMode: 'storyboard' };
        if (trimmedPrompt) {
          next.storyboardPrompt = prompt;
        } else {
          delete next.storyboardPrompt;
        }
        return next;
      });
    },
    [],
  );

  const syncStoryboardPromptToClips = useCallback(async () => {
    if (workspaceMode !== 'storyboard') return;
    const trimmedPrompt = storyboardPrompt.trim();
    await updateSelectedClipParams(
      trimmedPrompt
        ? { generationMode: 'storyboard', storyboardPrompt }
        : { generationMode: 'storyboard' },
      trimmedPrompt ? [] : ['storyboardPrompt'],
    );
  }, [storyboardPrompt, updateSelectedClipParams, workspaceMode]);

  const handleModeChange = useCallback(
    async (mode: VideoWorkspaceMode) => {
      setWorkspaceMode(mode);
      setGlobalVideoParams((prev) => ({ ...prev, generationMode: mode }));
      if (clips.length === 0) return;
      await Promise.all(
        clips.map((clip) => {
          const nextParams = { ...clipParams(clip), generationMode: mode };
          return updateClip(clip.id, {
            params: nextParams,
            ...(mode === 'storyboard' ? {} : { chainFromPrev: false }),
          });
        }),
      );
    },
    [clips, updateClip],
  );

  const handleVideoModelChange = useCallback(
    async (modelConfigId: string) => {
      const selectedModel = videoModels.find((model) => model.id === modelConfigId);
      if (!modelConfigId) {
        await updateSelectedClipParams({}, ['modelConfigId', 'model']);
        return;
      }
      await updateSelectedClipParams({
        modelConfigId,
        ...(selectedModel?.model ? { model: selectedModel.model } : {}),
      });
    },
    [updateSelectedClipParams, videoModels],
  );

  useEffect(() => {
    if (videoModels.length === 0) return;
    const currentId = typeof globalVideoParams.modelConfigId === 'string' ? globalVideoParams.modelConfigId : '';
    const stillExists = currentId && videoModels.some((model) => model.id === currentId);
    if (stillExists) return;
    const fallbackId = videoModels[0]?.id;
    if (!fallbackId || fallbackId === currentId) return;
    void handleVideoModelChange(fallbackId);
  }, [videoModels, globalVideoParams.modelConfigId, handleVideoModelChange]);

  const handleAddStoryboardClip = useCallback(
    async (duration: number) => {
      const nextDuration = resolveNextStoryboardClipDuration(clips, duration);
      if (nextDuration < STORYBOARD_TIMELINE_MIN_CLIP_DURATION) {
        toast.info(tToast('insufficientDuration'));
        return;
      }

      const params = buildStoryboardClipParams({
        duration: nextDuration,
        globalVideoParams,
        storyboardPrompt,
      });

      setWorkspaceMode('storyboard');
      await addClip({
        title: t('storyboardClipTitle', { order: clips.length + 1 }),
        prompt: '',
        params,
        chainFromPrev: clips.length > 0,
      });
    },
    [addClip, clips, globalVideoParams, storyboardPrompt, t, tToast],
  );

  const handleUseMaterialAsset = useCallback(
    async (asset: MaterialAsset) => {
      if (!selectedClip) {
        toast.info(tToast('selectClipFirst'));
        return;
      }
      const target = canUseMaterialAsTarget(asset, materialTarget)
        ? materialTarget
        : defaultMaterialTargetForType(asset.type);
      try {
        await videoWorkbenchActions.useMaterial(asset.id);
        await addMaterial(selectedClip.id, {
          role: target,
          sourceType: 'platform_asset',
          sourceId: asset.id,
          url: asset.url,
          name: asset.title,
          metadata: { materialAssetId: asset.id, sourceType: asset.sourceType },
        });
        setMaterialTarget(target);
        toast.success(tToast('placedInto', { target: roleLabel(target, materialTargetMessages) }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : tToast('materialUseFailed'));
      }
    },
    [addMaterial, materialTarget, materialTargetMessages, selectedClip, tToast],
  );

  const handleSwapFirstLastFrame = useCallback(async () => {
    if (!selectedClip) return;
    const first = selectedClip.materials.find((material) => material.role === 'first_frame');
    const last = selectedClip.materials.find((material) => material.role === 'last_frame');
    if (!first && !last) {
      toast.info(tToast('noFramesToSwap'));
      return;
    }
    try {
      if (first) await removeMaterial(first.id);
      if (last) await removeMaterial(last.id);
      if (first) {
        await addMaterial(selectedClip.id, {
          role: 'last_frame',
          sourceType: first.sourceType,
          sourceId: first.sourceId ?? undefined,
          url: first.url,
          name: first.name ?? undefined,
          metadata: first.metadata ?? undefined,
        });
      }
      if (last) {
        await addMaterial(selectedClip.id, {
          role: 'first_frame',
          sourceType: last.sourceType,
          sourceId: last.sourceId ?? undefined,
          url: last.url,
          name: last.name ?? undefined,
          metadata: last.metadata ?? undefined,
        });
      }
      toast.success(tToast('swappedFrames'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tToast('swapFramesFailed'));
    }
  }, [addMaterial, removeMaterial, selectedClip, tToast]);

  const handleOptimizeSelectedPrompt = useCallback(async () => {
    if (!selectedClip || !project || promptOptimizing) return;
    const isStoryboardMode = workspaceMode === 'storyboard';
    const prompt = isStoryboardMode ? storyboardPrompt.trim() : selectedClip.prompt?.trim();
    if (!prompt) {
      toast.info(isStoryboardMode ? tToast('emptyStoryboardPrompt') : tToast('emptyVideoPrompt'));
      return;
    }

    setPromptOptimizing(true);
    try {
      const params = {
        ...DEFAULT_VIDEO_PARAMS,
        ...globalVideoParams,
        ...clipParams(selectedClip),
        generationMode: workspaceMode,
        ...(isStoryboardMode ? { storyboardPrompt } : {}),
      };
      if (isStoryboardMode) {
        const message = buildStoryboardPromptOptimizationMessage({
          clip: selectedClip,
          title: selectedClip.title || t('shotTitleFallback', { order: selectedClip.order }),
          params,
          prompt,
        });
        const result = await runDirectorMessage(
          message,
          tToast('storyboardPromptOptimized'),
          `AI 优化整片提示词：\n${prompt}`,
        );
        const optimizedPrompt = extractStoryboardPromptFromDirectorContent(result?.content);
        if (optimizedPrompt) {
          setStoryboardPrompt(optimizedPrompt);
          setGlobalVideoParams((prev) => ({
            ...prev,
            generationMode: 'storyboard',
            storyboardPrompt: optimizedPrompt,
          }));
        }
        toast.success(tToast('storyboardPromptOptimized'));
        return;
      }

      const message = buildVideoPromptOptimizationMessage({
        clip: selectedClip,
        title: selectedClip.title || t('shotTitleFallback', { order: selectedClip.order }),
        params,
        prompt,
      });
      await runDirectorMessage(message, tToast('videoPromptOptimized'), `AI 优化当前视频提示词：\n${prompt}`);
      toast.success(tToast('videoPromptOptimized'));
    } catch {
      toast.error(isStoryboardMode ? tToast('storyboardPromptOptimizeFailed') : tToast('videoPromptOptimizeFailed'));
    } finally {
      setPromptOptimizing(false);
    }
  }, [
    globalVideoParams,
    project,
    promptOptimizing,
    runDirectorMessage,
    selectedClip,
    storyboardPrompt,
    workspaceMode,
    t,
    tToast,
  ]);

  const handleGenerateStoryboardFromTool = useCallback(async () => {
    const prompt = storyboardToolPrompt.trim();
    if (!prompt || storyboardToolLoading || !project) {
      if (!prompt) toast.info(tToast('emptyStoryboardIdea'));
      return;
    }

    setStoryboardToolLoading(true);
    try {
      setWorkspaceMode('storyboard');
      const targetCount = resolveStoryboardToolClipCount(storyboardToolClipCount);
      const suggestedClipDuration = suggestStoryboardClipDuration(targetCount);
      const suggestedTotalDuration = Math.min(
        STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
        suggestedClipDuration * targetCount,
      );
      const sharedParams = buildStoryboardGenerationSharedParams({
        globalVideoParams,
        selectedClip,
        storyboardPrompt,
      });
      const extraClips = [...clips]
        .filter((clip) => clip.order > targetCount)
        .sort((a, b) => b.order - a.order);
      const message = buildStoryboardGenerationMessage({
        prompt,
        targetCount,
        suggestedClipDuration,
        suggestedTotalDuration,
        sharedParams,
      });
      const result = await runDirectorMessage(
        message,
        tToast('storyboardGenerated', { count: targetCount }),
        `生成 ${targetCount} 个分镜脚本：\n${prompt}`,
      );
      if (result) {
        for (const clip of extraClips) {
          await deleteClip(result.clipIdMap[clip.id] ?? clip.id);
        }
      }
      setStoryboardToolsOpen(false);
      toast.success(tToast('storyboardGeneratedSuccess'));
    } catch {
      toast.error(tToast('storyboardGenerateFailed'));
    } finally {
      setStoryboardToolLoading(false);
    }
  }, [
    clips,
    deleteClip,
    globalVideoParams,
    project,
    runDirectorMessage,
    selectedClip,
    storyboardPrompt,
    storyboardToolClipCount,
    storyboardToolLoading,
    storyboardToolPrompt,
    tToast,
  ]);

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

  const handleApplyTemplate = async (template: WorkbenchVideoTemplate) => {
    setApplyingTemplateId(template.templateKey);
    try {
      setInspirationOpen(false);
      replaceDraftProject(buildTemplateDraft(template));
      setWorkspaceMode(template.templateKind === 'workflow' ? 'storyboard' : 'standard');
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const handleAddSelectedVideoToMaterial = useCallback(async () => {
    if (!selectedLatestGeneration?.videoUrl) return;
    try {
      await videoWorkbenchActions.createMaterial({
        type: 'video',
        title: selectedClip?.title || project?.title || tToast('defaultMaterialTitle'),
        url: selectedLatestGeneration.videoUrl,
        thumbnailUrl: selectedLatestGeneration.thumbnailUrl ?? selectedLatestGeneration.lastFrameUrl ?? null,
        sourceType: 'video_generation',
        sourceId: selectedLatestGeneration.id,
        metadata: {
          prompt: selectedLatestGeneration.resolvedPrompt,
          clipId: selectedLatestGeneration.clipId,
          projectId: selectedLatestGeneration.projectId,
          durationSec: selectedLatestGeneration.durationSec ?? null,
        },
      });
      toast.success(tToast('addedToMaterials'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tToast('addToMaterialsFailed'));
    }
  }, [project?.title, selectedClip?.title, selectedLatestGeneration, tToast]);

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
  ]);

  return (
    <VideoWorkbenchWorkspaceView
      loading={loading && !project}
      title={project?.title}
      lastError={lastError}
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
    />
  );
}
