'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  ChevronDown,
  Film,
  FolderOpen,
  History,
  ImageIcon,
  LayoutTemplate,
  Layers,
  Loader2,
  Music2,
  PanelLeftOpen,
  Play,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Video,
  Wrench,
  ArrowLeftRight,
  X,
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
  type GenerationPricingEstimateInput,
  type MaterialAsset,
  type MaterialAssetType,
  type ModelConfigItem,
  type VideoTemplate,
  type VideoWorkflowTemplate,
} from '@autix/shared-lib';
import { createLocalVideoProject, useVideoProjectStore, type VideoClip, type VideoProject } from '@autix/shared-store';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { VideoPreview } from './VideoPreview';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import { MaterialSlot } from './MaterialSlot';
import { MaterialPicker } from './MaterialPicker';
import { cn } from '../ui/utils';

type VideoWorkspaceMode = 'storyboard' | 'first_last_frame' | 'standard';
type VideoInspirationTab = 'templates' | 'history' | 'materials';
type VideoMaterialTarget =
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';

const VIDEO_MODE_OPTIONS: Array<{
  value: VideoWorkspaceMode;
  label: string;
  description: string;
}> = [
    {
      value: 'storyboard',
      label: '分镜脚本',
      description: '多镜头脚本、镜头连续和尾帧衔接',
    },
    {
      value: 'first_last_frame',
      label: '首尾帧',
      description: '用首帧和尾帧约束画面起止',
    },
    {
      value: 'standard',
      label: '普通模式',
      description: '单条提示词直接生成视频',
    },
  ];

const MATERIAL_TARGET_OPTIONS: Array<{
  value: VideoMaterialTarget;
  label: string;
  accepts: MaterialAssetType[];
}> = [
    { value: 'first_frame', label: '首帧', accepts: ['image'] },
    { value: 'last_frame', label: '尾帧', accepts: ['image'] },
    { value: 'reference_image', label: '参考图', accepts: ['image'] },
    { value: 'reference_video', label: '参考视频', accepts: ['video'] },
    { value: 'reference_audio', label: '背景音频', accepts: ['audio'] },
  ];

const STORYBOARD_PRESETS = [
  { count: 3, label: '3 镜头', description: '开场、主体、收束' },
  { count: 5, label: '5 镜头', description: '短视频常用节奏' },
  { count: 6, label: '6 镜头', description: '产品/剧情更完整' },
  { count: 8, label: '8 镜头', description: '分镜更细，适合复杂叙事' },
];

const DEFAULT_VIDEO_PARAMS = {
  duration: 5,
  ratio: '16:9',
  resolution: '1080p',
  generateAudio: true,
  generationMode: 'storyboard',
};

const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15].map((duration) => ({
  label: `${duration}s`,
  value: String(duration),
}));

const RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p' },
];

const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '1:1', value: '1:1' },
  { label: '21:9', value: '21:9' },
  { label: '自适应', value: 'adaptive' },
];

type WorkbenchVideoTemplate =
  | ({ templateKind: 'workflow'; templateKey: string } & VideoWorkflowTemplate)
  | ({ templateKind: 'standard'; templateKey: string } & VideoTemplate);

type VideoEstimateTarget =
  | { mode: 'single'; clipId: string }
  | { mode: 'batch'; clipIds: string[] };

interface VideoClipEstimate {
  clip: VideoClip;
  estimate: GenerationPricingEstimate;
  taskType: string;
  seconds: number;
  resolution: string;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
}

function normalizeVideoResolution(value: unknown): string {
  const resolution = String(value ?? '720p').toLowerCase();
  if (resolution.includes('1080')) return '1080p';
  if (resolution.includes('480')) return '480p';
  return '720p';
}

function normalizeVideoDuration(value: unknown): number {
  const duration = Number(value ?? 5);
  if (!Number.isFinite(duration) || duration <= 0) return 5;
  return Math.ceil(duration);
}

function resolveClipVideoModel(clip: VideoClip, videoModels: ModelConfigItem[]): ModelConfigItem | null {
  const modelConfigId = String((clip.params ?? {}).modelConfigId ?? '');
  if (!modelConfigId) return null;
  return videoModels.find((model) => model.id === modelConfigId) ?? null;
}

function resolveSeedancePricingTaskType(clip: VideoClip, videoModel?: ModelConfigItem | null): string {
  const params = clip.params ?? {};
  const model = String(params.model ?? videoModel?.model ?? videoModel?.name ?? '').toLowerCase();
  const resolution = normalizeVideoResolution(params.resolution);
  if (resolution === '1080p') return 'seedance_1080p';
  if (resolution === '480p') return 'seedance_480p';
  if (model.includes('fast')) return 'seedance_fast_720p';
  return 'seedance_720p';
}

function buildVideoEstimateInput(
  clip: VideoClip,
  videoModel?: ModelConfigItem | null,
): GenerationPricingEstimateInput & {
  seconds: number;
  resolution: string;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
} {
  const params = clip.params ?? {};
  const taskType = resolveSeedancePricingTaskType(clip, videoModel);
  const resolution = normalizeVideoResolution(params.resolution);
  const seconds = normalizeVideoDuration(params.duration);
  const referenceImages = clip.materials.filter((material) =>
    ['first_frame', 'last_frame', 'reference_image'].includes(material.role),
  ).length;
  const hasVideoInput = clip.materials.some((material) => material.role === 'reference_video');
  const hasAudioInput =
    clip.materials.some((material) => material.role === 'reference_audio') ||
    params.generateAudio === true ||
    params.generate_audio === true;
  const modelName =
    typeof params.model === 'string' && params.model.trim()
      ? params.model
      : videoModel?.model;

  return {
    taskType,
    modelName,
    resolution,
    seconds,
    referenceImages,
    hasVideoInput,
    hasAudioInput,
  };
}

function canGenerateClip(clip: VideoClip): boolean {
  return Boolean(clip.prompt?.trim() || clip.materials.length > 0);
}

function isVideoWorkspaceMode(value: unknown): value is VideoWorkspaceMode {
  return value === 'storyboard' || value === 'first_last_frame' || value === 'standard';
}

function defaultMaterialTargetForType(type: MaterialAssetType): VideoMaterialTarget {
  if (type === 'video') return 'reference_video';
  if (type === 'audio') return 'reference_audio';
  return 'first_frame';
}

function canUseMaterialAsTarget(asset: MaterialAsset, target: VideoMaterialTarget) {
  const option = MATERIAL_TARGET_OPTIONS.find((item) => item.value === target);
  return Boolean(option?.accepts.includes(asset.type));
}

function roleLabel(role: string) {
  if (role === 'first_frame') return '首帧';
  if (role === 'last_frame') return '尾帧';
  if (role === 'reference_image') return '参考图';
  if (role === 'reference_video') return '参考视频';
  if (role === 'reference_audio') return '背景音频';
  return role;
}

function clipParams(clip: VideoClip | null): Record<string, unknown> {
  return clip?.params && typeof clip.params === 'object' && !Array.isArray(clip.params)
    ? clip.params
    : {};
}

async function loadWorkbenchVideoTemplates(): Promise<WorkbenchVideoTemplate[]> {
  const [workflowResult, standardResult] = await Promise.allSettled([
    videoProjectApi.listWorkflowTemplates({ pageSize: 50 }),
    videoTemplateApi.list({ sort: 'popular', pageSize: 50 }),
  ]);
  const workflowTemplates =
    workflowResult.status === 'fulfilled'
      ? (workflowResult.value.data.items ?? []).map((tpl) => ({
        ...tpl,
        templateKind: 'workflow' as const,
        templateKey: `workflow:${tpl.id}`,
      }))
      : [];
  const standardTemplates =
    standardResult.status === 'fulfilled'
      ? (standardResult.value.data.items ?? []).map((tpl) => ({
        ...tpl,
        templateKind: 'standard' as const,
        templateKey: `standard:${tpl.id}`,
      }))
      : [];
  return [...workflowTemplates, ...standardTemplates];
}

function templateMatchesQuery(template: WorkbenchVideoTemplate, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const searchable = [
    template.title,
    template.description,
    template.category,
    ...(template.tags ?? []),
    template.templateKind === 'standard' ? template.prompt : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    searchable.includes(q) ||
    (template.templateKind === 'workflow' &&
      template.clips.some((clip) =>
        [clip.title, clip.promptTemplate].filter(Boolean).join(' ').toLowerCase().includes(q),
      ))
  );
}

function resolveVideoTemplateVariables(template: VideoTemplate): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of template.variables ?? []) {
    if (variable.default == null) continue;
    values[variable.key] = String(variable.default);
  }
  return values;
}

function resolvePromptVariables(prompt: string, values: Record<string, string>) {
  return prompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => {
    const value = values[key.trim()];
    return value == null ? match : value;
  });
}

function buildTemplateDraft(template: WorkbenchVideoTemplate) {
  if (template.templateKind === 'workflow') {
    return createLocalVideoProject(
      template.title,
      template.clips.map((clip) => ({
        title: clip.title,
        prompt: clip.promptTemplate,
        params: { ...DEFAULT_VIDEO_PARAMS, ...(clip.defaultParams ?? {}), generationMode: 'storyboard' },
        chainFromPrev: clip.chainFromPrevious,
      })),
      template.coverImage,
    );
  }

  const variables = resolveVideoTemplateVariables(template);
  const prompt = resolvePromptVariables(template.prompt, variables);
  const defaultParams =
    template.defaultParams && typeof template.defaultParams === 'object' && !Array.isArray(template.defaultParams)
      ? (template.defaultParams as Record<string, unknown>)
      : {};
  const variableDuration = Number(variables.duration);
  const paramsDuration = Number(defaultParams.duration);
  const duration =
    (Number.isFinite(variableDuration) && variableDuration > 0 ? variableDuration : undefined) ??
    (Number.isFinite(paramsDuration) && paramsDuration > 0 ? paramsDuration : undefined) ??
    template.durationSec ??
    5;

  return createLocalVideoProject(
    template.title,
    [
      {
        title: template.title,
        prompt,
        params: {
          ratio: '16:9',
          resolution: '1080p',
          generateAudio: true,
          generationMode: 'standard',
          ...defaultParams,
          duration,
        },
        chainFromPrev: false,
      },
    ],
    template.coverImage,
  );
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
  void directorModels;
  void directorModelsLoading;
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [videoModelsLoading, setVideoModelsLoading] = useState(false);
  const [selectedClipEstimate, setSelectedClipEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [selectedClipEstimateLoading, setSelectedClipEstimateLoading] = useState(false);
  const [promptOptimizing, setPromptOptimizing] = useState(false);
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
    const mode = clipParams(selectedClip).generationMode;
    if (isVideoWorkspaceMode(mode)) setWorkspaceMode(mode);
  }, [selectedClip?.id]);

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

  useEffect(() => {
    if (!selectedClip || !canGenerateClip(selectedClip)) {
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
  }, [selectedClip, videoModels]);

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
        selectedClip?.prompt?.trim() ||
        '';
      setStoryboardToolPrompt(seed);
      setStoryboardToolsOpen(true);
    },
    [selectedClip?.prompt],
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
      if (!selectedClip) return;
      const currentParams = { ...clipParams(selectedClip) };
      for (const key of removeKeys) delete currentParams[key];
      await updateClip(selectedClip.id, { params: { ...currentParams, ...partial } });
    },
    [selectedClip, updateClip],
  );

  const handleModeChange = useCallback(
    async (mode: VideoWorkspaceMode) => {
      setWorkspaceMode(mode);
      if (!selectedClip) return;
      const nextParams = { ...clipParams(selectedClip), generationMode: mode };
      await updateClip(selectedClip.id, {
        params: nextParams,
        ...(mode === 'storyboard' ? {} : { chainFromPrev: false }),
      });
    },
    [selectedClip, updateClip],
  );

  const handleVideoModelChange = useCallback(
    async (modelConfigId: string) => {
      if (!selectedClip) return;
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
    [selectedClip, updateSelectedClipParams, videoModels],
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
    const prompt = selectedClip.prompt?.trim();
    if (!prompt) {
      toast.info('请先输入视频提示词');
      return;
    }

    setPromptOptimizing(true);
    try {
      const params = {
        ...DEFAULT_VIDEO_PARAMS,
        ...clipParams(selectedClip),
        generationMode: workspaceMode,
      };
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
      toast.error('视频提示词优化失败');
    } finally {
      setPromptOptimizing(false);
    }
  }, [project, promptOptimizing, runDirectorMessage, selectedClip, workspaceMode]);

  const handleGenerateStoryboardFromTool = useCallback(async () => {
    const prompt = storyboardToolPrompt.trim();
    if (!prompt || storyboardToolLoading || !project) {
      if (!prompt) toast.info('请先输入分镜创意或视频提示词');
      return;
    }

    setStoryboardToolLoading(true);
    try {
      setWorkspaceMode('storyboard');
      const targetCount = Math.max(1, Math.min(12, storyboardToolClipCount));
      const currentParams = {
        ...DEFAULT_VIDEO_PARAMS,
        ...clipParams(selectedClip),
        generationMode: 'storyboard',
      };
      const extraClips = [...clips]
        .filter((clip) => clip.order > targetCount)
        .sort((a, b) => b.order - a.order);
      const message = [
        `请根据下面的视频创意，直接生成 ${targetCount} 个分镜脚本。`,
        '必须严格返回 <video_action> JSON，clips 数量必须等于指定分镜数量，不要返回普通说明。',
        '每个分镜需要包含 clipOrder、title、prompt、params、chainFromPrevious；prompt 要是可直接用于视频生成的完整镜头描述。',
        `统一参数：${JSON.stringify(currentParams)}`,
        'chainFromPrevious：第 1 个分镜为 false，其余分镜根据连续镜头需要优先设为 true。',
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
    project,
    runDirectorMessage,
    selectedClip,
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
    (clip: VideoClip) => {
      void estimateVideoClips({ mode: 'single', clipId: clip.id });
    },
    [estimateVideoClips],
  );

  const handleConfirmVideoGenerate = useCallback(async () => {
    const target = estimateTarget;
    if (!target) return;
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
  }, [clipEstimates, estimateTarget, generateAll, generateClip]);

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
            clip={selectedClip}
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
                generatingCount={generatingClipIds.length}
                projectId={project?.id ?? ''}
                onSelectClip={selectClip}
                onOpenTools={() => openStoryboardTool()}
                onOpenStoryboardTool={(prompt) => openStoryboardTool(prompt)}
                onPromptChange={(clip, prompt) => void updateClip(clip.id, { prompt })}
                onTitleChange={(clip, title) => void updateClip(clip.id, { title })}
                onOptimizePrompt={() => void handleOptimizeSelectedPrompt()}
                optimizingPrompt={promptOptimizing}
                onSwapFirstLastFrame={() => void handleSwapFirstLastFrame()}
              />

              <VideoGenerationDock
                clip={selectedClip}
                videoModels={videoModels}
                videoModelsLoading={videoModelsLoading}
                estimatedCost={selectedClipEstimate?.estimatedCost ?? null}
                estimatingCost={selectedClipEstimateLoading}
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

function VideoProductPanel({
  selectedClip,
  isGenerating,
  onAddSelectedVideoToMaterial,
}: {
  selectedClip: VideoClip | null;
  isGenerating: boolean;
  onAddSelectedVideoToMaterial: () => void;
}) {
  const selectedHasVideo = Boolean(
    selectedClip?.generations?.some((generation) => generation.status === 'completed' && generation.videoUrl),
  );

  if (!selectedHasVideo && !isGenerating) {
    return null;
  }

  return (
    <section className="flex min-h-[360px] flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">视频产物</h2>
          <p className="text-xs text-muted-foreground">当前视频预览和生成状态会在这里显示</p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="inline-flex h-8 items-center gap-2 rounded-md bg-primary/10 px-2.5 text-xs text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              生成中
            </div>
          )}
          {selectedHasVideo && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAddSelectedVideoToMaterial}>
              <Upload className="size-3.5" />
              加入素材库
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <VideoPreview clip={selectedClip} />
      </div>
    </section>
  );
}

function VideoWorkspaceConfigPanel({
  mode,
  clips,
  selectedClip,
  selectedClipId,
  generatingCount,
  projectId,
  onSelectClip,
  onOpenTools,
  onOpenStoryboardTool,
  onPromptChange,
  onTitleChange,
  onOptimizePrompt,
  optimizingPrompt,
  onSwapFirstLastFrame,
}: {
  mode: VideoWorkspaceMode;
  clips: VideoClip[];
  selectedClip: VideoClip | null;
  selectedClipId: string | null;
  generatingCount: number;
  projectId: string;
  onSelectClip: (clipId: string | null) => void;
  onOpenTools: () => void;
  onOpenStoryboardTool: (prompt?: string) => void;
  onPromptChange: (clip: VideoClip, prompt: string) => void;
  onTitleChange: (clip: VideoClip, title: string) => void;
  onOptimizePrompt: () => void;
  optimizingPrompt: boolean;
  onSwapFirstLastFrame: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<VideoMaterialTarget>('first_frame');
  const selectedParams = clipParams(selectedClip);
  const canOptimize = Boolean(selectedClip?.prompt?.trim()) && !optimizingPrompt;
  const promptLabel =
    mode === 'first_last_frame'
      ? '首尾帧视频提示词'
      : mode === 'standard'
        ? '普通视频提示词'
        : '分镜提示词';
  const materialSlots: Array<{ role: VideoMaterialTarget; label: string }> =
    mode === 'first_last_frame'
      ? [
        { role: 'first_frame', label: '首帧图片' },
        { role: 'last_frame', label: '尾帧图片' },
        { role: 'reference_audio', label: '背景音频' },
      ]
      : mode === 'standard'
        ? [
          { role: 'reference_image', label: '参考图片' },
          { role: 'reference_video', label: '参考视频' },
          { role: 'reference_audio', label: '背景音频' },
        ]
        : [];
  const openPicker = (role: VideoMaterialTarget) => {
    setPickerRole(role);
    setPickerOpen(true);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">创作配置</h2>
        </div>
      </div>

      {mode !== 'storyboard' && (
        <div className="mb-4 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-medium">
                {mode === 'first_last_frame' ? '首尾帧素材' : '参考素材'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {mode === 'first_last_frame'
                  ? '选择首帧、尾帧图片和背景音频；可一键对调首尾帧。'
                  : '可选择参考图片、参考视频与背景音频。'}
              </p>
            </div>
            {mode === 'first_last_frame' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onSwapFirstLastFrame}
                disabled={!selectedClip}
              >
                <ArrowLeftRight className="size-3" />
                对调首尾帧
              </Button>
            )}
          </div>
          {selectedClip ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {materialSlots.map((slot) => (
                <MaterialSlot
                  key={slot.role}
                  label={slot.label}
                  material={selectedClip.materials.find((material) => material.role === slot.role) ?? null}
                  isChained={slot.role === 'first_frame' && selectedClip.chainFromPrev}
                  onClick={() => openPicker(slot.role)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              正在准备素材槽
            </div>
          )}
        </div>
      )}

      {mode === 'storyboard' && (
        <div className="mb-4 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-medium">分镜脚本</h3>
              <p className="text-[11px] text-muted-foreground">从视频创意和右侧参数生成对应数量的分镜脚本</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenTools}>
              <Wrench className="size-3" />
              生成分镜
            </Button>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              还没有分镜，可以从 Tools 选择 3/5/6/8 镜头预设。
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {clips.map((clip) => {
                const active = clip.id === selectedClipId;
                const duration = Number(clipParams(clip).duration ?? 5);
                return (
                  <button
                    key={clip.id}
                    type="button"
                    className={cn(
                      'min-w-[170px] rounded-md border px-3 py-2 text-left transition-colors',
                      active ? 'border-primary bg-primary/8' : 'border-border bg-card hover:bg-accent',
                    )}
                    onClick={() => onSelectClip(clip.id)}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{clip.title || `分镜 ${clip.order}`}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{duration}s</span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {clip.prompt || '等待补充镜头描述'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedClip ? (
        <div className="space-y-3">
          {mode === 'storyboard' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">镜头标题</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary"
                value={selectedClip.title ?? `分镜 ${selectedClip.order}`}
                onChange={(event) => onTitleChange(selectedClip, event.target.value)}
              />
            </label>
          )}
          <label className="block space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{promptLabel}</span>
              <div className="flex items-center gap-2">
                {mode === 'storyboard' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => onOpenStoryboardTool(selectedClip.prompt ?? '')}
                  >
                    <Wrench className="size-3" />
                    生成分镜
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={!canOptimize}
                  onClick={onOptimizePrompt}
                >
                  {optimizingPrompt ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  AI 优化
                </Button>
              </div>
            </div>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder="描述主体、场景、镜头运动、节奏、光线、风格和关键动作。底部 chat 可以继续优化。"
              value={selectedClip.prompt ?? ''}
              onChange={(event) => onPromptChange(selectedClip, event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{String(selectedParams.resolution ?? '1080p')}</span>
            <span>{String(selectedParams.ratio ?? '16:9')}</span>
            <span>{String(selectedParams.duration ?? 5)}s</span>
            {generatingCount > 0 && <span>{generatingCount} 个任务生成中</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          正在准备镜头编辑区...
        </div>
      )}

      {selectedClip && mode !== 'storyboard' && (
        <MaterialPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          role={pickerRole}
          clipId={selectedClip.id}
          projectId={projectId}
        />
      )}
    </section>
  );
}

function VideoParameterPanel({
  open,
  mode,
  clip,
  onClose,
  onModeChange,
  onParamChange,
}: {
  open: boolean;
  mode: VideoWorkspaceMode;
  clip: VideoClip | null;
  onClose: () => void;
  onModeChange: (mode: VideoWorkspaceMode) => void;
  onParamChange: (partial: Record<string, unknown>, removeKeys?: string[]) => void;
}) {
  const params = clipParams(clip);

  return (
    <aside
      className={cn(
        'min-h-0 border-r border-border bg-muted/14',
        open
          ? 'fixed inset-y-0 left-0 z-40 flex w-[min(92vw,360px)] flex-col bg-background shadow-xl'
          : 'hidden',
        'xl:static xl:z-auto xl:flex xl:flex-col xl:bg-muted/14 xl:shadow-none',
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">视频参数</h2>
            <p className="truncate text-xs text-muted-foreground">模式与 Seedance 基础参数</p>
          </div>
          <button
            type="button"
            aria-label="关闭视频参数"
            className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          <section className="space-y-2">
            <PanelLabel icon={<Settings2 className="size-3.5" />} label="生成模式" />
            <div className="space-y-2">
              {VIDEO_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                    mode === option.value
                      ? 'border-primary bg-primary/8 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  onClick={() => onModeChange(option.value)}
                >
                  <div className="text-xs font-medium">{option.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{option.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label="基础参数" />
            <ParamSelect
              label="时长"
              value={String(params.duration ?? 5)}
              options={DURATION_OPTIONS}
              onChange={(value) => onParamChange({ duration: Number(value) })}
              disabled={!clip}
            />
            <ParamCardGroup
              label="分辨率"
              value={String(params.resolution ?? '1080p')}
              options={RESOLUTION_OPTIONS}
              onChange={(value) => onParamChange({ resolution: value })}
              disabled={!clip}
            />
            <ParamCardGroup
              label="画面比例"
              value={String(params.ratio ?? '16:9')}
              options={RATIO_OPTIONS}
              onChange={(value) => onParamChange({ ratio: value })}
              disabled={!clip}
            />
            <ParamCardGroup
              label="音频"
              value={params.generateAudio === false || params.generate_audio === false ? 'off' : 'on'}
              options={[
                { label: '有声', value: 'on' },
                { label: '无声', value: 'off' },
              ]}
              onChange={(value) => onParamChange({ generateAudio: value === 'on' }, ['generate_audio'])}
              disabled={!clip}
            />
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">Seed</span>
              <input
                className="h-9 rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
                placeholder="留空随机"
                value={params.seed == null ? '' : String(params.seed)}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onParamChange(value ? { seed: Number(value) } : {}, ['seed']);
                }}
                disabled={!clip}
              />
            </label>
          </section>
        </div>
      </div>
    </aside>
  );
}

function ParamSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 w-full border-border bg-background px-3 text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[70] rounded-lg">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function PanelLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ParamCardGroup({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-center text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/8 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VideoGenerationDock({
  clip,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  onVideoModelChange,
  onGenerate,
}: {
  clip: VideoClip | null;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const params = clipParams(clip);
  const canGenerate = clip ? canGenerateClip(clip) : false;
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {videoModels.length > 0 ? (
          <ModelPickerPopover
            candidates={videoModels}
            value={String(params.modelConfigId ?? '')}
            onChange={(id) => id && onVideoModelChange(id)}
            labels={{
              searchPlaceholder: '搜索视频模型 / 供应商',
              empty: '没有匹配的视频模型',
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
                    {videoModels.find((model) => model.id === params.modelConfigId)?.name ?? '选择视频模型'}
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
            <span className="truncate">{videoModelsLoading ? '加载视频模型' : '暂无视频模型，请联系管理员配置'}</span>
          </button>
        )}
        <Button
          type="button"
          className="h-10 gap-1.5 px-4"
          disabled={!clip || !canGenerate || clip.status === 'generating' || videoModels.length === 0}
          onClick={() => clip && onGenerate(clip)}
        >
          {clip?.status === 'generating' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          生成视频
          {estimatingCost ? (
            <Loader2 className="size-3.5 animate-spin opacity-80" />
          ) : estimatedCost != null ? (
            <span className="text-xs opacity-90">{estimatedCost} 积分</span>
          ) : null}
        </Button>
      </div>
    </section>
  );
}

function StoryboardToolsDialog({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  clipCount,
  onClipCountChange,
  params,
  loading,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  params: Record<string, unknown>;
  loading: boolean;
  onGenerate: () => void;
}) {
  const normalizedClipCount = String(clipCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4" />
            分镜脚本工具
          </DialogTitle>
          <DialogDescription>
            携带视频创意、右侧参数和分镜数量，让 LLM 直接生成对应分镜脚本。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[72vh] space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">视频创意 / Prompt</span>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder="输入视频主题、故事、风格、主体动作、镜头节奏等。也可以从底部 Prompt Chat 直接带入。"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
            />
          </label>

          <section className="space-y-2">
            <PanelLabel icon={<Layers className="size-3.5" />} label="分镜数量" />
            <div className="grid gap-2 sm:grid-cols-4">
              {STORYBOARD_PRESETS.map((preset) => (
                <button
                  key={preset.count}
                  type="button"
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left transition-colors',
                    clipCount === preset.count
                      ? 'border-primary bg-primary/8'
                      : 'border-border bg-background hover:border-primary/45 hover:bg-accent',
                  )}
                  onClick={() => onClipCountChange(preset.count)}
                >
                  <div className="text-sm font-medium">{preset.label}</div>
                  <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
            <Select value={normalizedClipCount} onValueChange={(value) => onClipCountChange(Number(value))}>
              <SelectTrigger className="h-9 w-full border-border bg-background px-3 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[70] rounded-lg">
                {[2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                  <SelectItem key={count} value={String(count)} className="text-xs">
                    {count} 个分镜
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-lg border border-border bg-muted/20 p-3">
            <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label="将携带的生成参数" />
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>时长：{String(params.duration ?? DEFAULT_VIDEO_PARAMS.duration)}s</div>
              <div>分辨率：{String(params.resolution ?? DEFAULT_VIDEO_PARAMS.resolution)}</div>
              <div>比例：{String(params.ratio ?? DEFAULT_VIDEO_PARAMS.ratio)}</div>
              <div>音频：{params.generateAudio === false || params.generate_audio === false ? '无声' : '有声'}</div>
            </div>
          </section>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              取消
            </Button>
          </DialogClose>
          <Button type="button" className="gap-1.5" disabled={!prompt.trim() || loading} onClick={onGenerate}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            生成分镜脚本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VideoInspirationSheet({
  open,
  onOpenChange,
  tab,
  onTabChange,
  templates,
  categories,
  templatesLoading,
  templateSearch,
  templateCategory,
  applyingId,
  onTemplateSearchChange,
  onTemplateCategoryChange,
  onApply,
  historyProjects,
  onSelectProject,
  materials,
  materialsLoading,
  materialSearch,
  materialType,
  materialTarget,
  onMaterialSearchChange,
  onMaterialTypeChange,
  onMaterialTargetChange,
  onUseMaterial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: VideoInspirationTab;
  onTabChange: (tab: VideoInspirationTab) => void;
  templates: WorkbenchVideoTemplate[];
  categories: string[];
  templatesLoading: boolean;
  templateSearch: string;
  templateCategory: string;
  applyingId: string | null;
  onTemplateSearchChange: (search: string) => void;
  onTemplateCategoryChange: (category: string) => void;
  onApply: (template: WorkbenchVideoTemplate) => void;
  historyProjects: VideoProject[];
  onSelectProject: (projectId: string) => void;
  materials: MaterialAsset[];
  materialsLoading: boolean;
  materialSearch: string;
  materialType: MaterialAssetType | 'all';
  materialTarget: VideoMaterialTarget;
  onMaterialSearchChange: (search: string) => void;
  onMaterialTypeChange: (type: MaterialAssetType | 'all') => void;
  onMaterialTargetChange: (target: VideoMaterialTarget) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(94vw,560px)] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="size-4 text-primary" />
            灵感库
          </SheetTitle>
          <SheetDescription className="sr-only">
            汇总视频模板、历史项目和图片视频素材。
          </SheetDescription>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
            <InspirationTabButton active={tab === 'templates'} icon={<LayoutTemplate className="size-3.5" />} onClick={() => onTabChange('templates')}>
              模板
            </InspirationTabButton>
            <InspirationTabButton active={tab === 'history'} icon={<History className="size-3.5" />} onClick={() => onTabChange('history')}>
              历史
            </InspirationTabButton>
            <InspirationTabButton active={tab === 'materials'} icon={<FolderOpen className="size-3.5" />} onClick={() => onTabChange('materials')}>
              素材
            </InspirationTabButton>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'templates' ? (
            <VideoInspirationTemplates
              templates={templates}
              categories={categories}
              loading={templatesLoading}
              search={templateSearch}
              category={templateCategory}
              applyingId={applyingId}
              onSearchChange={onTemplateSearchChange}
              onCategoryChange={onTemplateCategoryChange}
              onApply={onApply}
            />
          ) : tab === 'history' ? (
            <VideoInspirationHistory projects={historyProjects} onSelectProject={onSelectProject} />
          ) : (
            <VideoInspirationMaterials
              materials={materials}
              loading={materialsLoading}
              search={materialSearch}
              type={materialType}
              target={materialTarget}
              onSearchChange={onMaterialSearchChange}
              onTypeChange={onMaterialTypeChange}
              onTargetChange={onMaterialTargetChange}
              onUseMaterial={onUseMaterial}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InspirationTabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

function VideoInspirationTemplates({
  templates,
  categories,
  loading,
  search,
  category,
  applyingId,
  onSearchChange,
  onCategoryChange,
  onApply,
}: {
  templates: WorkbenchVideoTemplate[];
  categories: string[];
  loading: boolean;
  search: string;
  category: string;
  applyingId: string | null;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onApply: (template: WorkbenchVideoTemplate) => void;
}) {
  const hasActiveFilter = search.trim().length > 0 || category !== 'all';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="搜索模板、场景或标签"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <CategoryChip active={category === 'all'} onClick={() => onCategoryChange('all')}>
            全部
          </CategoryChip>
          {categories.map((item) => (
            <CategoryChip key={item} active={category === item} onClick={() => onCategoryChange(item)}>
              {item}
            </CategoryChip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          正在加载视频模板
        </div>
      ) : templates.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">{hasActiveFilter ? '没有匹配的视频模板' : '还没有可用模板'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveFilter ? '换一个关键词或分类试试。' : '可以用底部 chat 生成分镜。'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <VideoTemplateCard
              key={template.templateKey}
              template={template}
              applying={applyingId === template.templateKey}
              onApply={() => onApply(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoInspirationHistory({
  projects,
  onSelectProject,
}: {
  projects: VideoProject[];
  onSelectProject: (projectId: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <History className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">暂无历史项目</p>
        <p className="mt-1 text-xs text-muted-foreground">生成或保存过的视频项目会显示在这里。</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:border-primary/45 hover:bg-accent"
          onClick={() => onSelectProject(project.id)}
        >
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {project.coverImage ? (
              <img src={project.coverImage} alt={project.title} className="h-full w-full object-cover" />
            ) : (
              <Film className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{project.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {project.clips?.length ?? 0} 个镜头 · {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function VideoInspirationMaterials({
  materials,
  loading,
  search,
  type,
  target,
  onSearchChange,
  onTypeChange,
  onTargetChange,
  onUseMaterial,
}: {
  materials: MaterialAsset[];
  loading: boolean;
  search: string;
  type: MaterialAssetType | 'all';
  target: VideoMaterialTarget;
  onSearchChange: (search: string) => void;
  onTypeChange: (type: MaterialAssetType | 'all') => void;
  onTargetChange: (target: VideoMaterialTarget) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="搜索素材名称或标签"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={type} onValueChange={(value) => onTypeChange(value as MaterialAssetType | 'all')}>
            <SelectTrigger className="h-9 border-border bg-background text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[70] rounded-lg">
              <SelectItem value="all" className="text-xs">全部素材</SelectItem>
              <SelectItem value="image" className="text-xs">图片素材</SelectItem>
              <SelectItem value="video" className="text-xs">视频素材</SelectItem>
              <SelectItem value="audio" className="text-xs">音频素材</SelectItem>
            </SelectContent>
          </Select>
          <Select value={target} onValueChange={(value) => onTargetChange(value as VideoMaterialTarget)}>
            <SelectTrigger className="h-9 border-border bg-background text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[70] rounded-lg">
              {MATERIAL_TARGET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  放入{option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          正在加载素材库
        </div>
      ) : materials.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <FolderOpen className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">暂无匹配素材</p>
          <p className="mt-1 text-xs text-muted-foreground">图片、视频和音频素材都可以在这里选择。</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {materials.map((asset) => (
            <MaterialAssetCard
              key={asset.id}
              asset={asset}
              target={target}
              onUse={() => onUseMaterial(asset)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialAssetCard({
  asset,
  target,
  onUse,
}: {
  asset: MaterialAsset;
  target: VideoMaterialTarget;
  onUse: () => void;
}) {
  const supported = canUseMaterialAsTarget(asset, target);
  const fallbackTarget = defaultMaterialTargetForType(asset.type);
  const actionLabel = supported ? `放入${roleLabel(target)}` : `放入${roleLabel(fallbackTarget)}`;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/45">
      <div className="aspect-video bg-muted">
        {asset.type === 'image' ? (
          <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
        ) : asset.type === 'video' ? (
          <video src={asset.url} poster={asset.thumbnailUrl ?? undefined} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            {asset.type === 'audio' ? <Music2 className="size-7 text-muted-foreground" /> : <FolderOpen className="size-7 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">{asset.type === 'audio' ? '音频素材' : '文件素材'}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{asset.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{asset.type}</p>
          </div>
          {asset.type === 'image' ? (
            <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : asset.type === 'video' ? (
            <Video className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Music2 className="size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={onUse}>
          <Plus className="size-3.5" />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function VideoEstimateDialog({
  open,
  onOpenChange,
  loading,
  error,
  estimates,
  accountBalance,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: string | null;
  estimates: VideoClipEstimate[];
  accountBalance: number | null;
  onConfirm: () => void;
}) {
  const total = estimates.reduce((sum, item) => sum + item.estimate.estimatedCost, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            视频生成前确认
          </DialogTitle>
          <DialogDescription>
            Seedance 生成会先冻结预计积分，系统失败或供应商提交失败会按服务端策略退还。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[60vh] space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在估算视频生成积分...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">预计总消耗</span>
                  <strong>{total} 积分</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">可用余额</span>
                  <span>{accountBalance == null ? '未知' : `${accountBalance} 积分`}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">提交分镜</span>
                  <span>{estimates.length} 个</span>
                </div>
              </div>
              <div className="space-y-2">
                {estimates.map((item) => (
                  <div key={item.clip.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.clip.title || `分镜 ${item.clip.order}`}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.resolution} · {item.seconds}s · {item.estimate.ruleName}
                        </div>
                      </div>
                      <strong className="shrink-0">{item.estimate.estimatedCost} 积分</strong>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      {item.estimate.items.map((detail) => (
                        <div key={detail.label} className="flex items-center justify-between gap-2">
                          <span>{detail.label}</span>
                          <span>{detail.amount} 积分</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={loading || Boolean(error) || estimates.length === 0}>
            确认生成
            <Play className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'h-8 shrink-0 rounded-md border px-3 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function VideoTemplateCard({
  template,
  applying,
  onApply,
}: {
  template: WorkbenchVideoTemplate;
  applying: boolean;
  onApply: () => void;
}) {
  const clipCount = template.templateKind === 'workflow' ? template.clips.length : 1;
  const defaultParams =
    template.templateKind === 'standard'
      ? ((template.defaultParams ?? {}) as Record<string, unknown>)
      : {};
  const duration = template.templateKind === 'standard'
    ? Number(defaultParams.duration ?? template.durationSec ?? 5)
    : null;
  const metaLabel =
    template.templateKind === 'workflow'
      ? `${clipCount} 镜头`
      : `${Number.isFinite(duration) ? duration : 5}s · 单镜头`;
  const description =
    template.description ||
    (template.templateKind === 'workflow'
      ? '包含可直接编辑的分镜脚本、镜头参数与素材槽。'
      : '带入完整视频提示词和生成参数，可继续拆分镜或补充素材。');
  const kindLabel = template.templateKind === 'workflow' ? '分镜模板' : '视频模板';

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/45">
      <div className="aspect-video bg-muted">
        {template.coverImage ? (
          <img src={template.coverImage} alt={template.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers className="size-7 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{template.title}</p>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {kindLabel}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{template.category}</span>
          <span className="shrink-0">{metaLabel} · {template.useCount ?? 0} 次使用</span>
        </div>
        <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={applying} onClick={onApply}>
          {applying ? <Loader2 className="size-3.5 animate-spin" /> : <LayoutTemplate className="size-3.5" />}
          使用模板
        </Button>
      </div>
    </div>
  );
}
