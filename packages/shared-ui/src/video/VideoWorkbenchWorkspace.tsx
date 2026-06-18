'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderOpen,
  Loader2,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import {
  getAvailableModels,
  hasChatCapability,
  isVideoModel,
  materialsApi,
  pointsApi,
  videoProjectApi,
  videoTemplateApi,
  type GenerationPricingEstimate,
  type MaterialAsset,
  type MaterialAssetType,
  type ModelConfigItem,
} from '@autix/shared-lib';
import { createLocalVideoProject, useVideoProjectStore, type VideoClip } from '@autix/shared-store';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  buildTemplateDraft,
  buildVideoEstimateInput,
  canGenerateClip,
  canUseMaterialAsTarget,
  clampStoryboardClipDuration,
  clipParams,
  defaultMaterialTargetForType,
  isVideoWorkspaceMode,
  loadWorkbenchVideoTemplates,
  resolveClipVideoModel,
  resolveStoryboardPrompt,
  roleLabel,
  suggestStoryboardClipDuration,
  templateMatchesQuery,
  type VideoClipEstimate,
  type VideoEstimateTarget,
  type VideoInspirationTab,
  type VideoMaterialTarget,
  type VideoWorkspaceMode,
  type WorkbenchVideoTemplate,
} from './workbench/constants';
import { VideoParameterPanel } from './workbench/panels/VideoParameterPanel';
import { VideoWorkspaceConfigPanel } from './workbench/panels/VideoWorkspaceConfigPanel';
import { VideoProductPanel } from './workbench/panels/VideoProductPanel';
import { StoryboardToolsDialog } from './workbench/dialogs/StoryboardToolsDialog';
import { VideoInspirationSheet } from './workbench/dialogs/VideoInspirationSheet';
import { VideoEstimateDialog } from './workbench/dialogs/VideoEstimateDialog';

function extractStoryboardPromptFromDirectorContent(content: string | null | undefined): string | null {
  const paramsMatch = content?.match(/参数：(\{[^\n]+\})/);
  if (!paramsMatch) return null;
  try {
    const params = JSON.parse(paramsMatch[1]) as Record<string, unknown>;
    return typeof params.storyboardPrompt === 'string' && params.storyboardPrompt.trim()
      ? params.storyboardPrompt
      : null;
  } catch {
    return null;
  }
}

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
  const [paramsOpen, setParamsOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationTab, setInspirationTab] = useState<VideoInspirationTab>('templates');
  const [storyboardToolsOpen, setStoryboardToolsOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<VideoWorkspaceMode>('storyboard');
  const [globalVideoParams, setGlobalVideoParams] = useState<Record<string, unknown>>(
    () => ({ ...DEFAULT_VIDEO_PARAMS }),
  );
  const globalParamsSeededRef = useRef<string | null>(null);
  const [templates, setTemplates] = useState<WorkbenchVideoTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialAsset[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialType, setMaterialType] = useState<MaterialAssetType | 'all'>('all');
  const [materialTarget, setMaterialTarget] = useState<VideoMaterialTarget>('first_frame');
  const [directorModels, setDirectorModels] = useState<ModelConfigItem[]>([]);
  const [directorModelId, setDirectorModelId] = useState<string | null>(null);
  const [directorModelsLoading, setDirectorModelsLoading] = useState(false);
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [videoModelsLoading, setVideoModelsLoading] = useState(false);
  const [selectedClipEstimate, setSelectedClipEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [selectedClipEstimateLoading, setSelectedClipEstimateLoading] = useState(false);
  const [promptOptimizing, setPromptOptimizing] = useState(false);
  const [storyboardPrompt, setStoryboardPrompt] = useState('');
  const [storyboardToolPrompt, setStoryboardToolPrompt] = useState('');
  const [storyboardToolClipCount, setStoryboardToolClipCount] = useState(5);
  const [storyboardToolLoading, setStoryboardToolLoading] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateTarget, setEstimateTarget] = useState<VideoEstimateTarget | null>(null);
  const [clipEstimates, setClipEstimates] = useState<VideoClipEstimate[]>([]);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [appliedInitialTemplateId, setAppliedInitialTemplateId] = useState<string | null>(null);
  const creatingInitialClipRef = useRef(false);

  useEffect(() => {
    void loadOrCreateStandaloneProject();
  }, [loadOrCreateStandaloneProject]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    loadWorkbenchVideoTemplates()
      .then(async (items) => {
        if (cancelled) return;
        const extras: WorkbenchVideoTemplate[] = [];
        if (initialTemplateId && !items.some((item) => item.templateKind === 'standard' && item.id === initialTemplateId)) {
          try {
            const detail = await videoTemplateApi.getById(initialTemplateId);
            extras.push({
              ...detail.data,
              templateKind: 'standard' as const,
              templateKey: `standard:${detail.data.id}`,
            });
          } catch {
            // Keep the template picker usable even if a deep-linked template is unavailable.
          }
        }
        if (
          initialWorkflowTemplateId &&
          !items.some((item) => item.templateKind === 'workflow' && item.id === initialWorkflowTemplateId)
        ) {
          try {
            const detail = await videoProjectApi.getWorkflowTemplate(initialWorkflowTemplateId);
            extras.push({
              ...detail.data,
              templateKind: 'workflow' as const,
              templateKey: `workflow:${detail.data.id}`,
            });
          } catch {
            // Keep the template picker usable even if a deep-linked workflow template is unavailable.
          }
        }
        if (cancelled) return;
        setTemplates([...extras, ...items]);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialTemplateId, initialWorkflowTemplateId]);

  useEffect(() => {
    let cancelled = false;
    setDirectorModelsLoading(true);
    setVideoModelsLoading(true);
    getAvailableModels()
      .then((res) => {
        if (cancelled) return;
        const allModels = res.data ?? [];
        const models = allModels.filter(
          (model) => hasChatCapability(model.capabilities ?? []) && !isVideoModel(model),
        );
        setDirectorModels(models);
        setVideoModels(allModels.filter(isVideoModel));
        setDirectorModelId((current) => current ?? models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setDirectorModels([]);
          setVideoModels([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDirectorModelsLoading(false);
          setVideoModelsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    pointsApi
      .getSummary()
      .then((res) => {
        if (cancelled) return;
        setAccountBalance(res.data?.account?.availableBalance ?? res.data?.account?.balance ?? null);
      })
      .catch(() => {
        if (!cancelled) setAccountBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, generatingClipIds.length]);

  const clips = project?.clips ?? [];
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? clips[0] ?? null;

  useEffect(() => {
    if (!project || clips.length > 0 || creatingInitialClipRef.current) return;
    creatingInitialClipRef.current = true;
    addClip({
      title: '镜头 1',
      prompt: '',
      params: { ...DEFAULT_VIDEO_PARAMS, generationMode: workspaceMode },
      chainFromPrev: false,
    }).finally(() => {
      creatingInitialClipRef.current = false;
    });
  }, [addClip, clips.length, project, workspaceMode]);

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
    if (!inspirationOpen || inspirationTab !== 'materials') return;
    let cancelled = false;
    setMaterialsLoading(true);
    const timer = window.setTimeout(() => {
      materialsApi
        .list({
          type: materialType,
          search: materialSearch.trim() || undefined,
          pageSize: 80,
        })
        .then((res) => {
          if (!cancelled) setMaterials(res.data.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setMaterials([]);
        })
        .finally(() => {
          if (!cancelled) setMaterialsLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inspirationOpen, inspirationTab, materialSearch, materialType]);

  useEffect(() => {
    if (inspirationOpen && inspirationTab === 'history') {
      void loadProjects();
    }
  }, [inspirationOpen, inspirationTab, loadProjects]);

  const selectedLatestGeneration = useMemo(
    () =>
      selectedClip?.generations
        ?.filter((generation) => generation.status === 'completed' && generation.videoUrl)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
    [selectedClip],
  );
  const templateCategories = useMemo(
    () => Array.from(new Set(templates.map((tpl) => tpl.category).filter(Boolean))).sort(),
    [templates],
  );
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchSearch = templateMatchesQuery(tpl, templateSearch);
      const matchCategory = templateCategory === 'all' || tpl.category === templateCategory;
      return matchSearch && matchCategory;
    });
  }, [templateCategory, templateSearch, templates]);

  const selectedClipCanGenerate = useMemo(
    () =>
      Boolean(
        selectedClip &&
        (canGenerateClip(selectedClip) ||
          (workspaceMode === 'storyboard' && storyboardPrompt.trim())),
      ),
    [selectedClip, storyboardPrompt, workspaceMode],
  );

  useEffect(() => {
    if (!selectedClip || !selectedClipCanGenerate) {
      setSelectedClipEstimate(null);
      setSelectedClipEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedClipEstimateLoading(true);
    const timer = window.setTimeout(() => {
      const videoModel = resolveClipVideoModel(selectedClip, videoModels);
      const estimateInput = buildVideoEstimateInput(selectedClip, videoModel);
      pointsApi
        .estimate(estimateInput)
        .then((res) => {
          if (!cancelled) setSelectedClipEstimate(res.data);
        })
        .catch(() => {
          if (!cancelled) setSelectedClipEstimate(null);
        })
        .finally(() => {
          if (!cancelled) setSelectedClipEstimateLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedClip, selectedClipCanGenerate, videoModels]);

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
    async (message: string, fallbackContent = '已更新视频工作台。', _displayContent = message) => {
      if (!message.trim() || !project) return null;
      try {
        const persisted = await persistDraftProject({ withConversation: true });
        const serverProject = persisted.project;
        const res = await videoProjectApi.directorChat(serverProject.id, {
          message,
          modelId: directorModelId ?? undefined,
        });
        const content = res.data.content || fallbackContent;
        await loadProject(serverProject.id);
        return {
          content,
          projectId: serverProject.id,
          clipIdMap: persisted.clipIdMap,
        };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'AI 导演请求失败');
        throw err;
      }
    },
    [directorModelId, loadProject, persistDraftProject, project],
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

  const handleAddStoryboardClip = useCallback(
    async (duration: number) => {
      const fallbackDuration = suggestStoryboardClipDuration(clips.length || 1);
      const currentTotalDuration = clips.reduce(
        (total, clip) => total + clampStoryboardClipDuration(clipParams(clip).duration ?? fallbackDuration),
        0,
      );
      const remainingDuration = Math.max(0, STORYBOARD_TIMELINE_TOTAL_MAX_DURATION - currentTotalDuration);
      const nextDuration = Math.min(
        STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
        remainingDuration,
        Number.isFinite(duration) ? duration : STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
      );

      if (nextDuration < STORYBOARD_TIMELINE_MIN_CLIP_DURATION) {
        toast.info('剩余时长不足以新增分镜');
        return;
      }

      const trimmedStoryboardPrompt = storyboardPrompt.trim();
      const params: Record<string, unknown> = {
        ...DEFAULT_VIDEO_PARAMS,
        ...globalVideoParams,
        generationMode: 'storyboard',
        duration: nextDuration,
        ...(trimmedStoryboardPrompt ? { storyboardPrompt } : {}),
      };
      delete params.startTime;
      delete params.endTime;
      delete params.start;
      delete params.end;

      setWorkspaceMode('storyboard');
      await addClip({
        title: `分镜 ${clips.length + 1}`,
        prompt: '',
        params,
        chainFromPrev: clips.length > 0,
      });
    },
    [addClip, clips, globalVideoParams, storyboardPrompt],
  );

  const handleUseMaterialAsset = useCallback(
    async (asset: MaterialAsset) => {
      if (!selectedClip) {
        toast.info('请先选择一个镜头');
        return;
      }
      const target = canUseMaterialAsTarget(asset, materialTarget)
        ? materialTarget
        : defaultMaterialTargetForType(asset.type);
      try {
        await materialsApi.use(asset.id);
        await addMaterial(selectedClip.id, {
          role: target,
          sourceType: 'platform_asset',
          sourceId: asset.id,
          url: asset.url,
          name: asset.title,
          metadata: { materialAssetId: asset.id, sourceType: asset.sourceType },
        });
        setMaterialTarget(target);
        toast.success(`已放入${roleLabel(target)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '当前无法使用素材');
      }
    },
    [addMaterial, materialTarget, selectedClip],
  );

  const handleSwapFirstLastFrame = useCallback(async () => {
    if (!selectedClip) return;
    const first = selectedClip.materials.find((material) => material.role === 'first_frame');
    const last = selectedClip.materials.find((material) => material.role === 'last_frame');
    if (!first && !last) {
      toast.info('当前没有首帧或尾帧可以对调');
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
      toast.success('已对调首尾帧');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '对调首尾帧失败');
    }
  }, [addMaterial, removeMaterial, selectedClip]);

  const handleOptimizeSelectedPrompt = useCallback(async () => {
    if (!selectedClip || !project || promptOptimizing) return;
    const isStoryboardMode = workspaceMode === 'storyboard';
    const prompt = isStoryboardMode ? storyboardPrompt.trim() : selectedClip.prompt?.trim();
    if (!prompt) {
      toast.info(isStoryboardMode ? '请先输入整片提示词' : '请先输入视频提示词');
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
        const responseShape = {
          action: 'update_params',
          clipOrder: selectedClip.order,
          title: selectedClip.title || `镜头 ${selectedClip.order}`,
          params: {
            ...params,
            storyboardPrompt: '优化后的整片视频提示词',
          },
          chainFromPrevious: selectedClip.chainFromPrev,
        };
        const message = [
          '请优化分镜模式的整片提示词。',
          '要求：保留原始创意，不改每个分镜的单镜头 prompt；补充整片统一风格、视觉质感、镜头节奏、主体限制、转场连续性和生成模型更容易理解的约束。',
          '只把优化后的整片提示词写入 params.storyboardPrompt。',
          '必须只返回 <video_action> JSON，不要输出其他解释。',
          `返回格式：${JSON.stringify(responseShape)}`,
          `原始整片提示词：${prompt}`,
        ].join('\n');
        const result = await runDirectorMessage(
          message,
          '已优化整片提示词。',
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
        toast.success('整片提示词已优化');
        return;
      }

      const responseShape = {
        action: 'update_prompt',
        clipOrder: selectedClip.order,
        title: selectedClip.title || `镜头 ${selectedClip.order}`,
        prompt: '优化后的完整视频提示词',
        params,
        chainFromPrevious: selectedClip.chainFromPrev,
      };
      const message = [
        `请优化第 ${selectedClip.order} 个视频片段的提示词。`,
        '要求：保留原始创意，不改变画面主体；补充镜头运动、动作节奏、光线、构图、质感和生成模型更容易理解的细节。',
        '必须只返回 <video_action> JSON，不要输出其他解释。',
        `返回格式：${JSON.stringify(responseShape)}`,
        `原始提示词：${prompt}`,
      ].join('\n');
      await runDirectorMessage(message, '已优化视频提示词。', `AI 优化当前视频提示词：\n${prompt}`);
      toast.success('视频提示词已优化');
    } catch {
      toast.error(isStoryboardMode ? '整片提示词优化失败' : '视频提示词优化失败');
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
  ]);

  const handleGenerateStoryboardFromTool = useCallback(async () => {
    const prompt = storyboardToolPrompt.trim();
    if (!prompt || storyboardToolLoading || !project) {
      if (!prompt) toast.info('请先输入分镜创意或视频提示词');
      return;
    }

    setStoryboardToolLoading(true);
    try {
      setWorkspaceMode('storyboard');
      const allowedClipCounts = new Set([2, 3, 5, 6, 7, 8]);
      const targetCount = allowedClipCounts.has(storyboardToolClipCount) ? storyboardToolClipCount : 5;
      const suggestedClipDuration = suggestStoryboardClipDuration(targetCount);
      const currentStoryboardPrompt = storyboardPrompt.trim();
      const currentParams: Record<string, unknown> = {
        ...DEFAULT_VIDEO_PARAMS,
        ...globalVideoParams,
        ...clipParams(selectedClip),
        duration: suggestedClipDuration,
        generationMode: 'storyboard',
        ...(currentStoryboardPrompt ? { storyboardPrompt } : {}),
      };
      if (!currentStoryboardPrompt) delete currentParams.storyboardPrompt;
      delete currentParams.startTime;
      delete currentParams.endTime;
      delete currentParams.start;
      delete currentParams.end;
      const extraClips = [...clips]
        .filter((clip) => clip.order > targetCount)
        .sort((a, b) => b.order - a.order);
      const message = [
        `请根据下面的视频创意 / Prompt，严格拆成 ${targetCount} 个连续分镜脚本。`,
        `分镜数量必须正好等于 ${targetCount}：clipOrder 必须从 1 到 ${targetCount} 连续编号，不能少、不能多、不能合并输出。`,
        '所有分镜在时间轴上必须紧密连续排列，不存在中间空白段；不要输出 startTime、endTime、start、end 等起止时间字段。',
        '每个分镜需要包含 clipOrder、title、prompt、params、chainFromPrevious；title 用作简短摘要，prompt 必须是可直接用于视频生成的完整镜头描述。',
        `每个分镜 params.duration 必须是 ${STORYBOARD_TIMELINE_MIN_CLIP_DURATION}-${STORYBOARD_TIMELINE_MAX_CLIP_DURATION} 秒的整数；优先使用 ${suggestedClipDuration} 秒，并尽量让总时长不超过 ${STORYBOARD_TIMELINE_TOTAL_MAX_DURATION} 秒。`,
        `统一参数：${JSON.stringify(currentParams)}`,
        'chainFromPrevious：第 1 个分镜为 false，其余分镜根据连续镜头需要优先设为 true。',
        '必须严格返回 <video_action> JSON，不要返回普通说明、Markdown 或额外解释。',
        `视频创意 / Prompt：${prompt}`,
      ].join('\n');
      const result = await runDirectorMessage(
        message,
        `已生成 ${targetCount} 个分镜脚本。`,
        `生成 ${targetCount} 个分镜脚本：\n${prompt}`,
      );
      if (result) {
        for (const clip of extraClips) {
          await deleteClip(result.clipIdMap[clip.id] ?? clip.id);
        }
      }
      setStoryboardToolsOpen(false);
      toast.success('分镜脚本已生成');
    } catch {
      toast.error('分镜脚本生成失败');
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
  ]);

  const estimateVideoClips = useCallback(async (target: VideoEstimateTarget) => {
    const targetClips =
      target.mode === 'single'
        ? clips.filter((clip) => clip.id === target.clipId)
        : clips.filter((clip) => target.clipIds.includes(clip.id));
    if (targetClips.length === 0) return;

    setEstimateTarget(target);
    setEstimateOpen(true);
    setEstimateLoading(true);
    setEstimateError(null);
    setClipEstimates([]);

    try {
      const results = await Promise.all(
        targetClips.map(async (clip): Promise<VideoClipEstimate> => {
          const estimateInput = buildVideoEstimateInput(clip, resolveClipVideoModel(clip, videoModels));
          const res = await pointsApi.estimate(estimateInput);
          return {
            clip,
            estimate: res.data,
            taskType: estimateInput.taskType,
            seconds: estimateInput.seconds,
            resolution: estimateInput.resolution,
            referenceImages: estimateInput.referenceImages,
            hasVideoInput: estimateInput.hasVideoInput,
            hasAudioInput: estimateInput.hasAudioInput,
          };
        }),
      );
      setClipEstimates(results);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : '视频计费估算失败');
    } finally {
      setEstimateLoading(false);
    }
  }, [clips, videoModels]);

  const handleRequestClipGenerate = useCallback(
    async (clip: VideoClip) => {
      await syncStoryboardPromptToClips();
      void estimateVideoClips({ mode: 'single', clipId: clip.id });
    },
    [estimateVideoClips, syncStoryboardPromptToClips],
  );

  const handleConfirmVideoGenerate = useCallback(async () => {
    const target = estimateTarget;
    if (!target) return;
    await syncStoryboardPromptToClips();
    setEstimateOpen(false);
    setEstimateTarget(null);
    setClipEstimates([]);
    const total = clipEstimates.reduce((sum, item) => sum + item.estimate.estimatedCost, 0);
    setAccountBalance((cur) => (cur == null ? cur : Math.max(0, cur - total)));
    if (target.mode === 'single') {
      await generateClip(target.clipId);
    } else {
      await generateAll();
    }
  }, [clipEstimates, estimateTarget, generateAll, generateClip, syncStoryboardPromptToClips]);

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
      await materialsApi.create({
        type: 'video',
        title: selectedClip?.title || project?.title || '视频生成素材',
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
      toast.success('已加入素材库');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加入素材库失败');
    }
  }, [project?.title, selectedClip?.title, selectedLatestGeneration]);

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

  if (loading && !project) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        正在打开视频工作台...
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 bg-background text-foreground">
      {paramsOpen && (
        <button
          type="button"
          aria-label="关闭视频参数"
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm xl:hidden"
          onClick={() => setParamsOpen(false)}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project?.title ?? '专业视频工作台'}</h1>
            <p className="truncate text-xs text-muted-foreground">
              Seedance API · 首尾帧 / 普通 / 分镜模式 · Prompt 优化
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 xl:hidden" onClick={() => setParamsOpen(true)}>
              <PanelLeftOpen className="size-3.5" />
              <span className="hidden sm:inline">参数</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateBlankProject}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">新建</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInspirationOpen(true)}>
              <FolderOpen className="size-3.5" />
              <span className="hidden sm:inline">灵感库</span>
            </Button>
          </div>
        </header>

        {lastError && (
          <div className="border-b border-destructive/20 bg-destructive/8 px-4 py-2 text-sm text-destructive">
            {lastError}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)]">
          <VideoParameterPanel
            open={paramsOpen}
            mode={workspaceMode}
            params={globalVideoParams}
            hasClip={Boolean(selectedClip)}
            onClose={() => setParamsOpen(false)}
            onModeChange={(mode) => void handleModeChange(mode)}
            onParamChange={(partial, removeKeys) => void updateSelectedClipParams(partial, removeKeys)}
          />

          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4">
              <VideoProductPanel
                selectedClip={selectedClip}
                isGenerating={generatingClipIds.length > 0}
                onAddSelectedVideoToMaterial={() => void handleAddSelectedVideoToMaterial()}
              />

              <VideoWorkspaceConfigPanel
                mode={workspaceMode}
                clips={clips}
                selectedClip={selectedClip}
                selectedClipId={selectedClip?.id ?? null}
                storyboardPrompt={storyboardPrompt}
                projectId={project?.id ?? ''}
                onSelectClip={selectClip}
                onOpenTools={() => openStoryboardTool(storyboardPrompt)}
                onAddClip={(duration) => void handleAddStoryboardClip(duration)}
                onStoryboardPromptChange={handleStoryboardPromptChange}
                onStoryboardPromptBlur={() => void syncStoryboardPromptToClips()}
                onPromptChange={(clip, prompt) => void updateClip(clip.id, { prompt })}
                onTitleChange={(clip, title) => void updateClip(clip.id, { title })}
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
                modelConfigId={
                  typeof globalVideoParams.modelConfigId === 'string'
                    ? globalVideoParams.modelConfigId
                    : ''
                }
                videoModels={videoModels}
                videoModelsLoading={videoModelsLoading}
                estimatedCost={selectedClipEstimate?.estimatedCost ?? null}
                estimatingCost={selectedClipEstimateLoading}
                canGenerate={selectedClipCanGenerate}
                onTextModelChange={setDirectorModelId}
                onVideoModelChange={(modelId) => void handleVideoModelChange(modelId)}
                onGenerate={(clip) => handleRequestClipGenerate(clip)}
              />
            </div>
          </div>
        </div>
      </main>

      <VideoInspirationSheet
        open={inspirationOpen}
        onOpenChange={setInspirationOpen}
        tab={inspirationTab}
        onTabChange={setInspirationTab}
        templates={filteredTemplates}
        categories={templateCategories}
        templatesLoading={templatesLoading}
        templateSearch={templateSearch}
        templateCategory={templateCategory}
        applyingId={applyingTemplateId}
        onTemplateSearchChange={setTemplateSearch}
        onTemplateCategoryChange={setTemplateCategory}
        onApply={(template) => void handleApplyTemplate(template)}
        historyProjects={projects}
        onSelectProject={(projectId) => void handleOpenHistoryProject(projectId)}
        materials={materials}
        materialsLoading={materialsLoading}
        materialSearch={materialSearch}
        materialType={materialType}
        materialTarget={materialTarget}
        onMaterialSearchChange={setMaterialSearch}
        onMaterialTypeChange={setMaterialType}
        onMaterialTargetChange={setMaterialTarget}
        onUseMaterial={(asset) => void handleUseMaterialAsset(asset)}
      />
      <StoryboardToolsDialog
        open={storyboardToolsOpen}
        onOpenChange={setStoryboardToolsOpen}
        prompt={storyboardToolPrompt}
        onPromptChange={setStoryboardToolPrompt}
        clipCount={storyboardToolClipCount}
        onClipCountChange={setStoryboardToolClipCount}
        directorModels={directorModels}
        directorModelId={directorModelId}
        directorModelsLoading={directorModelsLoading}
        onDirectorModelChange={setDirectorModelId}
        params={clipParams(selectedClip)}
        loading={storyboardToolLoading}
        onGenerate={() => void handleGenerateStoryboardFromTool()}
      />
      <VideoEstimateDialog
        open={estimateOpen}
        onOpenChange={(open) => {
          setEstimateOpen(open);
          if (!open) {
            setEstimateTarget(null);
            setClipEstimates([]);
            setEstimateError(null);
          }
        }}
        loading={estimateLoading}
        error={estimateError}
        estimates={clipEstimates}
        accountBalance={accountBalance}
        onConfirm={() => void handleConfirmVideoGenerate()}
      />
    </div >
  );
}
