'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronDown,
  Clock,
  Film,
  FileVideo,
  History,
  LayoutTemplate,
  Layers,
  Loader2,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getAvailableModels,
  getConversationMessages,
  hasChatCapability,
  isVideoModel,
  pointsApi,
  videoProjectApi,
  videoTemplateApi,
  type ConversationMessage,
  type GenerationPricingEstimate,
  type GenerationPricingEstimateInput,
  type ModelConfigItem,
  type VideoTemplate,
  type VideoWorkflowTemplate,
} from '@autix/shared-lib';
import { createLocalVideoProject, useVideoProjectStore, type VideoClip } from '@autix/shared-store';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';
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
import { VideoPreview } from './VideoPreview';
import { ClipEditor } from './ClipEditor';
import { VideoHistoryPanel } from './VideoHistoryPanel';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import { cn } from '../ui/utils';

interface DirectorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DIRECTOR_INTRO_MESSAGE: DirectorMessage = {
  id: 'intro',
  role: 'assistant',
  content:
    '告诉我你要做什么视频，我可以直接拆成分镜脚本，并为每个镜头设置时长、比例、分辨率和 Seedance 参数。',
};

function toDirectorMessage(message: ConversationMessage): DirectorMessage {
  return {
    id: message.id,
    role: message.role === 'USER' ? 'user' : 'assistant',
    content: message.content,
  };
}

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
    ['first_frame', 'reference_image'].includes(material.role),
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
  return Boolean(clip.prompt || clip.materials.some((material) => material.role === 'first_frame'));
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
        params: clip.defaultParams ?? {},
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
          ...defaultParams,
          duration,
        },
        chainFromPrev: false,
      },
    ],
    template.coverImage,
  );
}

export function VideoWorkbenchWorkspace() {
  const {
    project,
    loading,
    selectedClipId,
    loadProject,
    loadOrCreateStandaloneProject,
    persistDraftProject,
    replaceDraftProject,
    selectClip,
    addClip,
    generateClip,
    generateAll,
    generatingClipIds,
    lastError,
  } = useVideoProjectStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<WorkbenchVideoTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [directorModels, setDirectorModels] = useState<ModelConfigItem[]>([]);
  const [directorModelId, setDirectorModelId] = useState<string | null>(null);
  const [directorModelsLoading, setDirectorModelsLoading] = useState(false);
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [videoModelsLoading, setVideoModelsLoading] = useState(false);
  const [selectedClipEstimate, setSelectedClipEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [selectedClipEstimateLoading, setSelectedClipEstimateLoading] = useState(false);
  const [directorInput, setDirectorInput] = useState('');
  const [directorMessages, setDirectorMessages] = useState<DirectorMessage[]>([DIRECTOR_INTRO_MESSAGE]);
  const [directorLoading, setDirectorLoading] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateTarget, setEstimateTarget] = useState<VideoEstimateTarget | null>(null);
  const [clipEstimates, setClipEstimates] = useState<VideoClipEstimate[]>([]);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  useEffect(() => {
    void loadOrCreateStandaloneProject();
  }, [loadOrCreateStandaloneProject]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    loadWorkbenchVideoTemplates()
      .then((items) => {
        if (cancelled) return;
        setTemplates(items);
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
  }, []);

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
    const conversationId = project?.conversationId;
    if (!conversationId) {
      if (!directorLoading) setDirectorMessages([DIRECTOR_INTRO_MESSAGE]);
      return;
    }
    if (directorLoading) return;
    let cancelled = false;
    getConversationMessages(conversationId, 40)
      .then((res) => {
        if (cancelled) return;
        const messages = (res.data ?? []).map(toDirectorMessage);
        setDirectorMessages(messages.length > 0 ? messages : [DIRECTOR_INTRO_MESSAGE]);
      })
      .catch(() => {
        if (!cancelled) setDirectorMessages([DIRECTOR_INTRO_MESSAGE]);
      });
    return () => {
      cancelled = true;
    };
  }, [directorLoading, project?.conversationId]);

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
  const totalDuration = clips.reduce(
    (sum, clip) => sum + Number((clip.params as Record<string, unknown>)?.duration ?? 5),
    0,
  );
  const completedCount = clips.reduce(
    (sum, clip) =>
      sum + (clip.generations?.some((g) => g.status === 'completed' && g.videoUrl) ? 1 : 0),
    0,
  );
  const batchGeneratableClipCount = clips.filter(canGenerateClip).length;
  const canBatchGenerate =
    clips.length > 1 &&
    batchGeneratableClipCount > 0 &&
    generatingClipIds.length === 0 &&
    !estimateOpen &&
    !estimateLoading;
  const shouldShowSelectedClipPreview = Boolean(
    selectedClip &&
      ((selectedClip.generations?.length ?? 0) > 0 ||
        selectedClip.materials?.some((material) => material.role === 'first_frame')),
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
  const selectedDirectorModel = directorModels.find((model) => model.id === directorModelId) ?? null;
  const canDirectorGenerate = Boolean(directorInput.trim());

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

  const handleAddClip = useCallback(async () => {
    await addClip({
      title: `分镜 ${clips.length + 1}`,
      prompt: '',
      params: { duration: 5, ratio: '16:9', resolution: '1080p', generateAudio: true },
      chainFromPrev: clips.length > 0,
    });
  }, [addClip, clips.length]);

  const handleCreateBlankProject = useCallback(() => {
    replaceDraftProject(createLocalVideoProject());
    setHistoryOpen(false);
    setTemplateOpen(false);
    setDirectorMessages([DIRECTOR_INTRO_MESSAGE]);
  }, [replaceDraftProject]);

  const handleOpenHistoryProject = useCallback(
    async (projectId: string) => {
      await loadProject(projectId);
      setHistoryOpen(false);
      setTemplateOpen(false);
    },
    [loadProject],
  );

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

  const handleRequestBatchGenerate = useCallback(() => {
    const headClips = clips.filter((clip) => !clip.chainFromPrev && clip.status === 'pending' && canGenerateClip(clip));
    const fallback = clips.find((clip) => clip.status === 'pending' && canGenerateClip(clip));
    const targetClips = headClips.length > 0 ? headClips : fallback ? [fallback] : [];
    if (targetClips.length === 0) return;
    void estimateVideoClips({ mode: 'batch', clipIds: targetClips.map((clip) => clip.id) });
  }, [clips, estimateVideoClips]);

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

  const handleDirectorSend = async () => {
    const message = directorInput.trim();
    if (!message || !project || directorLoading) return;

    setDirectorMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: message },
    ]);
    setDirectorInput('');
    setDirectorLoading(true);

    try {
      const persisted = await persistDraftProject({ withConversation: true });
      const serverProject = persisted.project;
      const res = await videoProjectApi.directorChat(serverProject.id, {
        message,
        modelId: directorModelId ?? undefined,
      });
      setDirectorMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.data.content || '已更新分镜脚本。',
        },
      ]);
      await loadProject(serverProject.id);
    } catch (err) {
      setDirectorMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'AI 导演请求失败',
        },
      ]);
    } finally {
      setDirectorLoading(false);
    }
  };

  const handleApplyTemplate = async (template: WorkbenchVideoTemplate) => {
    setApplyingTemplateId(template.templateKey);
    try {
      setTemplateOpen(false);
      replaceDraftProject(buildTemplateDraft(template));
      setDirectorMessages((prev) => [
        ...prev,
        {
          id: `tpl-${Date.now()}`,
          role: 'assistant',
          content:
            template.templateKind === 'workflow'
              ? `已基于「${template.title}」创建分镜草稿，镜头和参数已带入工作台。`
              : `已基于「${template.title}」创建视频草稿，提示词和生成参数已带入工作台。`,
        },
      ]);
    } finally {
      setApplyingTemplateId(null);
    }
  };

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
      {directorOpen && (
        <button
          type="button"
          aria-label="关闭面板"
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm xl:hidden"
          onClick={() => setDirectorOpen(false)}
        />
      )}
      <aside
        className={cn(
          'h-full w-[330px] shrink-0 flex-col border-r border-border bg-muted/18',
          directorOpen
            ? 'fixed inset-y-0 left-0 z-40 flex bg-background shadow-xl'
            : 'hidden',
          'lg:static lg:z-auto lg:flex lg:bg-muted/18 lg:shadow-none',
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">成片助手</h2>
              <p className="truncate text-xs text-muted-foreground">LLM 分镜脚本与导演建议</p>
            </div>
            <button
              type="button"
              aria-label="关闭成片助手"
              className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              onClick={() => setDirectorOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {directorMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border px-3 py-2 text-sm leading-6 ${
                  message.role === 'user'
                    ? 'border-primary/20 bg-primary/8 text-foreground'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {directorLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                正在拆分镜...
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-3">
          <textarea
            className="min-h-28 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="例如：生成一个 30 秒产品发布短片，竖屏，分 6 个镜头..."
            value={directorInput}
            onChange={(e) => setDirectorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleDirectorSend();
              }
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            {directorModels.length > 0 ? (
              <ModelPickerPopover
                candidates={directorModels}
                value={directorModelId}
                onChange={setDirectorModelId}
                memoryKey="video-director"
                disabledClear
                labels={{
                  searchPlaceholder: '搜索文本模型 / 供应商',
                  recent: '最近分析模型',
                  empty: '没有匹配的文本模型',
                }}
                trigger={
                  <button
                    type="button"
                    aria-label="选择文本分析模型"
                    className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 text-left text-xs outline-none transition-colors hover:bg-accent"
                  >
                    <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {selectedDirectorModel?.name ?? '文本分析模型'}
                    </span>
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  </button>
                }
              />
            ) : (
              <button
                type="button"
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 text-left text-xs text-muted-foreground"
                disabled
              >
                {directorModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                <span className="truncate">{directorModelsLoading ? '加载模型' : '暂无文本模型'}</span>
              </button>
            )}
            <Button
              className="h-9 shrink-0 gap-1.5 px-3"
              disabled={!canDirectorGenerate || directorLoading || !project}
              onClick={handleDirectorSend}
            >
              {directorLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              生成分镜
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project?.title ?? '专业视频工作台'}</h1>
            <p className="truncate text-xs text-muted-foreground">
              Seedance API · 分镜脚本 · 图片/视频/音频素材 · 多镜头生成
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={() => setDirectorOpen(true)}>
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">助手</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateBlankProject}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">新建</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="size-3.5" />
              <span className="hidden sm:inline">模板</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setHistoryOpen((v) => !v)}>
              <History className="size-3.5" />
              <span className="hidden sm:inline">历史</span>
            </Button>
          </div>
        </header>

        {lastError && (
          <div className="border-b border-destructive/20 bg-destructive/8 px-4 py-2 text-sm text-destructive">
            {lastError}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <MetricChip icon={<Layers className="size-3.5" />} label="分镜" value={`${clips.length} 个`} />
              <MetricChip icon={<Clock className="size-3.5" />} label="总时长" value={`${totalDuration}s`} />
              <MetricChip icon={<Film className="size-3.5" />} label="已出片" value={`${completedCount} 个`} />
            </section>

            <StoryboardPanel
              clips={clips}
              selectedClipId={selectedClip?.id ?? null}
              onSelect={selectClip}
              onAddClip={handleAddClip}
              onBatchGenerate={handleRequestBatchGenerate}
              canBatchGenerate={canBatchGenerate}
              batchGeneratableClipCount={batchGeneratableClipCount}
              isBatchGenerating={generatingClipIds.length > 0}
            />

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">当前分镜编辑</h2>
                <p className="text-xs text-muted-foreground">素材、时长、比例、分辨率和 Seedance 参数集中在这里调整</p>
              </div>
              <ClipEditor
                clip={selectedClip}
                projectId={project?.id ?? ''}
                onRequestGenerate={handleRequestClipGenerate}
                videoModels={videoModels}
                videoModelsLoading={videoModelsLoading}
                estimatedCost={selectedClipEstimate?.estimatedCost ?? null}
                estimatingCost={selectedClipEstimateLoading}
                onVideoModelCreated={(model) => setVideoModels((prev) => [...prev, model])}
              />
            </section>

            {shouldShowSelectedClipPreview && (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold">生成预览</h2>
                  <p className="text-xs text-muted-foreground">仅显示当前分镜已有的生成结果或生成状态</p>
                </div>
                <VideoPreview clip={selectedClip} />
              </section>
            )}
          </div>
        </div>
      </main>

      {historyOpen && (
        <aside className="absolute right-0 top-0 z-30 h-full w-[320px] border-l border-border bg-background shadow-xl">
          <VideoHistoryPanel
            onClose={() => setHistoryOpen(false)}
            onSelectProject={(projectId) => void handleOpenHistoryProject(projectId)}
          />
        </aside>
      )}
      <VideoTemplateSheet
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        templates={filteredTemplates}
        categories={templateCategories}
        loading={templatesLoading}
        search={templateSearch}
        category={templateCategory}
        applyingId={applyingTemplateId}
        onSearchChange={setTemplateSearch}
        onCategoryChange={setTemplateCategory}
        onApply={(template) => void handleApplyTemplate(template)}
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

function StoryboardPanel({
  clips,
  selectedClipId,
  onSelect,
  onAddClip,
  onBatchGenerate,
  canBatchGenerate,
  batchGeneratableClipCount,
  isBatchGenerating,
}: {
  clips: VideoClip[];
  selectedClipId: string | null;
  onSelect: (clipId: string | null) => void;
  onAddClip: () => void;
  onBatchGenerate: () => void;
  canBatchGenerate: boolean;
  batchGeneratableClipCount: number;
  isBatchGenerating: boolean;
}) {
  const batchDisabledReason =
    clips.length < 2
      ? '多个分镜时才需要批量生成；单个分镜请使用下方“生成视频”。'
      : batchGeneratableClipCount === 0
        ? '至少有一个分镜需要填写提示词或添加首帧图片。'
        : '正在生成分镜，请等待当前任务完成。';

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">分镜脚本</h2>
          <p className="text-xs text-muted-foreground">逐镜头编辑；多分镜时可批量提交生成任务</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!canBatchGenerate}
                  onClick={onBatchGenerate}
                >
                  {isBatchGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  批量生成分镜
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {canBatchGenerate
                ? `会按顺序为 ${batchGeneratableClipCount} 个已有提示词或首帧的分镜发起生成。`
                : batchDisabledReason}
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddClip}>
            <Plus className="size-3.5" />
            添加分镜
          </Button>
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
          <FileVideo className="mb-3 size-9 text-muted-foreground/60" />
          <p className="text-sm font-medium">还没有分镜</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            让左侧成片助手生成脚本，或手动添加第一个分镜。
          </p>
          <Button className="mt-4 gap-2" onClick={onAddClip}>
            <Plus className="size-4" />
            添加分镜
          </Button>
        </div>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {clips.map((clip) => {
            const active = clip.id === selectedClipId;
            const duration = Number((clip.params as Record<string, unknown>)?.duration ?? 5);
            return (
              <button
                key={clip.id}
                type="button"
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary/8'
                    : 'border-border bg-background hover:bg-accent'
                }`}
                onClick={() => onSelect(clip.id)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {clip.title || `分镜 ${clip.order}`}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {duration}s
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {clip.prompt || '等待填写镜头描述、人物动作、镜头运动和画面风格'}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function VideoTemplateSheet({
  open,
  onOpenChange,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(92vw,560px)] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <LayoutTemplate className="size-4 text-primary" />
            视频模板
          </SheetTitle>
          <SheetDescription className="sr-only">
            选择常用视频结构，快速创建可编辑的视频草稿。
          </SheetDescription>
          <p className="text-xs text-muted-foreground" aria-hidden="true">
            选择常用结构，快速创建可编辑的视频草稿；已有作品会保留在历史中。
          </p>
        </SheetHeader>

        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder="搜索模板、场景或标签"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              正在加载视频模板
            </div>
          ) : templates.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">
                {hasActiveFilter ? '没有匹配的视频模板' : '还没有可用模板'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasActiveFilter
                  ? '换一个关键词或分类试试。'
                  : '可以使用成片助手生成分镜，或手动添加第一个镜头。'}
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
      </SheetContent>
    </Sheet>
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
