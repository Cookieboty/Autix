'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AtSign,
  Clock3,
  Coins,
  Diamond,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Music,
  Plus,
  Sparkles,
  Video,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { computeTaskEstimate, type ParamsSchema, type PricingSchema } from '@autix/domain/pricing';
import { type ModelConfigItem } from '@autix/shared-store';
import { MagneticButton } from '../../GrowthInteractions';
import {
  buildPublicVideoEstimateInput,
  getVideoReferenceUploadLimit,
  resolveVideoCapabilityFromModelConfig,
} from '../../generator-video-presenters';
import type { PublicVideoReference } from '../generator-studio-helpers';
import {
  VideoModelParamMenu,
  VideoOptionParamMenu,
  VideoRangeParamMenu,
  VideoSliderParamMenu,
} from './VideoParamMenus';
import { AspectRatioIcon } from '../image/ImageParamMenus';
import { VideoAssetPanel } from './VideoAssetPanel';
import { PromptMentionInput, type PromptMentionItem } from './PromptMentionInput';
import { AudioWaveThumb } from './AudioWaveThumb';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/dialog';
import {
  buildPublicVideoGenerationPayload,
  type PublicVideoGenerationPayload,
} from './public-video-generation';

/** 侧栏顶部展示 banner 的背景视频，与首页 Seedance 2.0 卡片同源 */
const VIDEO_BANNER_SRC = 'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4';

function limitPublicVideoReferences(refs: PublicVideoReference[], limit: number) {
  if (limit <= 0) return [];
  return refs.slice(-limit);
}

export function VideoSidebar({
  assetPanelHost,
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  paramsSchema,
  pricingSchema,
  pricingContext,
  generating,
  onGenerate,
  onModelChange,
  textModels,
  textModelsLoading,
  selectedTextModelId,
  onTextModelChange,
  optimizing,
  onOptimizePrompt,
}: {
  /** 素材面板的 portal 宿主（右栏容器）；为 null 时不渲染面板 */
  assetPanelHost?: HTMLElement | null;
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  generating: boolean;
  onGenerate: (payload: PublicVideoGenerationPayload) => Promise<void>;
  onModelChange: (modelId: string) => void;
  textModels: ModelConfigItem[];
  textModelsLoading: boolean;
  selectedTextModelId: string | null;
  onTextModelChange: (modelId: string) => void;
  optimizing: boolean;
  onOptimizePrompt: (prompt: string) => Promise<string | null>;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tImagePrompt = useTranslations('imageStudio.prompt');
  const videoCapability = useMemo(
    () => resolveVideoCapabilityFromModelConfig(selectedModel, initialModel),
    [initialModel, selectedModel],
  );
  // 表单选项**从模型自己的 paramsSchema 出**（enum + default）——每个模型按自己的 schema
  // 渲染，不写死、不用全局共享的比例/分辨率集。paramsSchema 缺失（未配置）时才回退到能力表。
  const videoParams = useMemo(() => {
    const props = paramsSchema?.properties as
      | Record<
        string,
        {
          enum?: unknown[];
          default?: unknown;
          minimum?: number;
          maximum?: number;
          'x-ui'?: { control?: string; order?: number; step?: number };
        }
      >
      | undefined;
    // schema 存在即**权威**：可选集/默认值完全由该模型自己的 schema 决定，schema 里没有的
    // 属性 = 该模型不支持，**不逐字段回退到能力表**（否则会给 Grok Imagine 这种无 resolution
    // 的模型硬塞一个档位、再发给上游）。仅当模型完全没配 paramsSchema 时才回退能力表。
    if (props) {
      const nums = (v: unknown[] | undefined) =>
        Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : [];
      const strs = (v: unknown[] | undefined) =>
        Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : [];
      const durations = nums(props.duration?.enum);
      const ratios = strs(props.ratio?.enum);
      const resolutions = strs(props.resolution?.enum);
      // duration 有两种形态：离散 enum（chips）或连续区间（stepper，如 Seedance 4~15）。
      // 只认 enum 会让连续区间的模型整个丢掉时长控件——默认模型 Seedance 2.0 Fast 正是这种。
      const durationProp = props.duration;
      const durationRange =
        durations.length === 0 &&
          typeof durationProp?.minimum === 'number' &&
          typeof durationProp?.maximum === 'number'
          ? {
            min: durationProp.minimum,
            max: durationProp.maximum,
            step: durationProp['x-ui']?.step ?? 1,
          }
          : null;
      // 渲染顺序与控件类型都由 schema 的 x-ui 决定，不再写死
      const controls = Object.entries(props)
        .map(([key, prop]) => ({
          key,
          control: prop['x-ui']?.control ?? 'chips',
          order: prop['x-ui']?.order ?? 999,
        }))
        .filter((entry) => entry.control !== 'hidden')
        .sort((a, b) => a.order - b.order);
      return {
        durations,
        durationRange,
        controls,
        ratios,
        resolutions,
        supportsAudio: 'generate_audio' in props,
        defaultDuration:
          typeof props.duration?.default === 'number'
            ? (props.duration.default as number)
            : durations[0] ?? durationRange?.min,
        defaultResolution:
          typeof props.resolution?.default === 'string' ? (props.resolution.default as string) : resolutions[0],
        defaultRatio:
          typeof props.ratio?.default === 'string' ? (props.ratio.default as string) : ratios[0],
        defaultAudio:
          typeof props.generate_audio?.default === 'boolean' ? (props.generate_audio.default as boolean) : false,
      };
    }
    // 模型完全没配 paramsSchema 时才回退能力表；顺序沿用历史布局
    return {
      durations: videoCapability.durations,
      durationRange: null as { min: number; max: number; step: number } | null,
      controls: [
        { key: 'resolution', control: 'chips', order: 10 },
        { key: 'duration', control: 'chips', order: 20 },
        { key: 'ratio', control: 'chips', order: 30 },
        ...(videoCapability.audio ? [{ key: 'generate_audio', control: 'switch', order: 40 }] : []),
      ],
      ratios: videoCapability.ratios as string[],
      resolutions: videoCapability.resolutions,
      supportsAudio: videoCapability.audio,
      defaultDuration: videoCapability.defaultDuration,
      defaultResolution: videoCapability.defaultResolution,
      defaultRatio: videoCapability.defaultRatio,
      defaultAudio: videoCapability.audio,
    };
  }, [paramsSchema, videoCapability]);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(videoParams.defaultDuration);
  const [resolution, setResolution] = useState(videoParams.defaultResolution);
  const [ratio, setRatio] = useState<string>(videoParams.defaultRatio);
  const [generateAudio, setGenerateAudio] = useState(videoParams.defaultAudio);
  const [selectedVideoRefs, setSelectedVideoRefs] = useState<PublicVideoReference[]>([]);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  /** 缩略图上「更多」触发的放大预览 */
  const [previewRef, setPreviewRef] = useState<PublicVideoReference | null>(null);
  /** 提示词编辑器节点：点卡片空白处时把焦点交给它 */
  const promptEditorRef = useRef<HTMLDivElement | null>(null);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const textModelOptions = useMemo(
    () => textModels.map((item) => ({ value: item.id, label: item.name })),
    [textModels],
  );
  const selectedTextModel = textModels.find((item) => item.id === selectedTextModelId) ?? null;
  const optimizeModelLabel = textModelsLoading
    ? t('modelLoading')
    : selectedTextModel?.name ?? t('optimizeModel');
  const model = selectedModelValue ?? initialModel ?? undefined;
  const modelLabel = selectedModel?.name ?? videoCapability.displayName;
  const uploadLimit = getVideoReferenceUploadLimit(selectedModel);
  const hasVideoRefs = selectedVideoRefs.length > 0;
  // @ 提及列表：按媒体类型分别从 1 开始编号 —— Image 1/2/3、Video 1/2、Audio 1。
  // 编号跟随选中顺序，移除某一项后其后的会重排（与用户看到的缩略图顺序保持一致）。
  const mentionItems = useMemo<PromptMentionItem[]>(() => {
    const counters: Record<string, number> = {};
    return selectedVideoRefs.map((ref) => {
      const kind = ref.mediaType ?? 'image';
      counters[kind] = (counters[kind] ?? 0) + 1;
      const name = kind.charAt(0).toUpperCase() + kind.slice(1);
      return {
        id: ref.id,
        label: `${name} ${counters[kind]}`,
        url: ref.url,
        mediaType: kind,
      };
    });
  }, [selectedVideoRefs]);
  const durationOptions = videoParams.durations;
  const ratioOptions = useMemo(
    () =>
      videoParams.ratios.map((value) => {
        // adaptive / auto 都是「自动」——都渲染成 t('auto')。
        if (value === 'adaptive' || value === 'auto') {
          return { value, label: t('auto') };
        }
        // 其余 ratio 走 i18n key；但 videoParams.ratios 直接来自 pricing schema 的
        // enum（见 VideoSidebar 上方 useMemo），可能包含 domain 的 VideoAspectRatio
        // union 之外的值（如 2:3 / 3:2 / 4:5 / 1:4 …）。缺 key 时用 raw value 当 label：
        // ratio 本身就是"x:y"这种数字对，天然可读，且不需要跨 locale 翻译（现有 JSON
        // 里除了 adaptive 也都是 key === value 的 identity 映射）。
        const key = `videoRatios.${value}`;
        return { value, label: t.has(key) ? t(key) : value };
      }),
    [t, videoParams.ratios],
  );
  const resolutionOptions = useMemo(
    () => videoParams.resolutions.map((value) => {
      // 与 ratioOptions 同理：resolutions 直接来自 pricing schema enum，
      // 未来新模型可能出现未预置的档位（例如 2k/3k）——缺 key 时用 raw value。
      const key = `videoResolutions.${value}`;
      return { value, label: t.has(key) ? t(key) : value };
    }),
    [t, videoParams.resolutions],
  );
  const ratioLabel = ratioOptions.find((option) => option.value === ratio)?.label ?? ratio;
  const durationLabel = `${duration}s`;

  // 切模型时按新模型 schema 的可选集/默认值收敛当前选择（旧选择不在新集合里就回默认）。
  useEffect(() => {
    setResolution((current) =>
      videoParams.resolutions.includes(current) ? current : videoParams.defaultResolution,
    );
    setDuration((current) => {
      // 连续区间只需落在 [min,max] 内即算有效；离散档位才要求命中枚举
      const range = videoParams.durationRange;
      if (range) {
        return current >= range.min && current <= range.max ? current : videoParams.defaultDuration;
      }
      return videoParams.durations.includes(current) ? current : videoParams.defaultDuration;
    });
    setRatio((current) =>
      videoParams.ratios.includes(current) ? current : videoParams.defaultRatio,
    );
    setGenerateAudio((current) => (videoParams.supportsAudio ? current : false));
  }, [videoParams]);

  useEffect(() => {
    setSelectedVideoRefs((current) => limitPublicVideoReferences(current, uploadLimit));
  }, [uploadLimit]);

  useEffect(() => {
    if (!selectedModel || !pricingSchema || !paramsSchema) {
      setEstimateCost(null);
      return;
    }

    // 本地即时计价：与服务端 estimateCost 调**同一个** computeTaskEstimate（同函数 →
    // 同结果，保证展示 == 扣费）。不再走 /points/estimate，无网络往返、无 250ms 防抖延迟。
    // 报价参数 == 生成参数：buildPublicVideoEstimateInput 归一化 resolution、seconds、
    // referenceImages 等隐藏计价参数。video_generation 与 image 一样 taskFixedSchema 恒为
    // null（presets.ts: video_generation.fixedCostSchema = null）。
    const { params } = buildPublicVideoEstimateInput({
      model,
      modelConfig: selectedModel,
      duration,
      resolution,
      generateAudio,
      referenceImages: selectedVideoRefs.length,
    });
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: pricingContext.multiplier,
      discountFactor: pricingContext.discountFactor,
      taskFixedSchema: null,
      params,
    });
    setEstimateCost(result.violations.length > 0 ? null : result.total);
  }, [
    pricingSchema,
    paramsSchema,
    pricingContext,
    duration,
    generateAudio,
    model,
    resolution,
    selectedModel,
    selectedVideoRefs.length,
  ]);

  const removeVideoRef = (id: string) => {
    setSelectedVideoRefs((current) => current.filter((ref) => ref.id !== id));
  };

  const handleOptimize = async () => {
    if (optimizing) return;
    const current = prompt.trim();
    if (!current) {
      setOptimizeError(t('optimizeEmpty'));
      return;
    }
    setOptimizeError(null);
    try {
      const optimized = await onOptimizePrompt(current);
      if (optimized) setPrompt(optimized);
    } catch {
      setOptimizeError(t('optimizeFailed'));
    }
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    try {
      await onGenerate(
        buildPublicVideoGenerationPayload({
          prompt,
          model,
          selectedModelId,
          modelName: selectedModel?.model,
          duration,
          resolution,
          ratio,
          generateAudio,
          materials: selectedVideoRefs,
        }),
      );
    } catch (err) {
      // 注意：SDK 拦截器把后端 msg 挂在 error.msg 上，不是 error.message
      // （error.message 只是 axios 的通用 "Request failed with status code 4xx"）。
      const message = (err as { msg?: string })?.msg ?? (err instanceof Error ? err.message : t('generateFailed'));
      setGenerateError(message);
    }
  };

  // 侧栏高度自适应内容；仅当内容超过视口时才封顶并内部滚动，避免短内容时留大片空档
  // sticky 的 top 必须等于外层容器的上内边距（py-3 = 12px）：
  // sticky 会把「顶边距滚动容器顶部不足 top」的元素直接下推，若写大于 12px 的值，
  // 首屏未滚动时侧栏就会比右栏低一截（滚动容器已在导航之下，无需再让开导航高度）。
  return (
    <aside className="growth-sidebar-shadow growth-panel flex rounded-[16px] border lg:sticky lg:top-3 lg:max-h-[calc(100svh-8rem)] lg:flex-col">
      <div className="growth-dark-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {/* 纯展示 banner：不可点、不可换。视频取自首页 Seedance 2.0 的演示片。
            muted + playsInline 是移动端自动播放的硬性要求，缺一个都不会播。 */}
        <div className="relative mb-2.5 h-[132px] w-full overflow-hidden rounded-[13px] bg-black/40">
          <video
            src={VIDEO_BANNER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            className="size-full object-cover"
          />
          {/* 底部渐变，保证叠字在任意帧上都可读 */}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/92 via-background/35 to-transparent" />
          <span className="pointer-events-none absolute inset-x-3 bottom-2.5">
            <span className="block text-lg font-black uppercase leading-tight text-growth-accent">
              {t('bannerGeneral')}
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-foreground/72">
              {modelLabel}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMediaDialogOpen(true)}
          className="growth-inset-top-highlight group relative grid min-h-[132px] w-full cursor-pointer place-items-center overflow-hidden rounded-[13px] growth-panel-item p-3 text-center text-sm text-foreground/48 border border-dashed transition hover:border-white/25 hover:text-foreground"
        >
          <span className="growth-radial-top-overlay pointer-events-none absolute inset-0 opacity-80" />
          {hasVideoRefs ? (
            // 固定 56px 小卡，一排 4 个、居中，超出自动换行。
            // 用 grid 而非 flex-wrap：列数写死才能保证"一排 4 个"，flex 会随可用宽度变成 3 或 5 个。
            <span className="relative grid w-full grid-cols-4 justify-items-center gap-2.5 pt-1">
              {selectedVideoRefs.map((ref) => (
                <span
                  key={ref.id}
                  // 音频没有画面，横向铺开成一条波形，占两格更好认
                  className={`group/thumb relative h-14 shrink-0 ${ref.mediaType === 'audio' ? 'col-span-2 w-full' : 'w-14'
                    }`}
                >
                  {/* 白边框只在悬浮时出现；平时留同宽透明边，避免 hover 瞬间尺寸跳动 */}
                  <span className="block size-full overflow-hidden rounded-[10px] border-2 border-transparent bg-black/35 transition group-hover/thumb:border-white">
                    {ref.mediaType === 'video' ? (
                      <video src={ref.url} muted playsInline preload="metadata" className="size-full object-cover" />
                    ) : ref.mediaType === 'audio' ? (
                      <AudioWaveThumb seed={ref.id} bars={34} className="px-2" />
                    ) : (
                      <img src={ref.url} alt={ref.name} className="size-full object-cover" />
                    )}
                  </span>

                  {/* 悬浮：中间「更多操作」。只有图片有——视频/音频在这个尺寸下没什么可看的。
                      stopPropagation 是必须的：整块上传区是个 button，不拦就会冒上去把资产面板打开。 */}
                  {(ref.mediaType ?? 'image') === 'image' ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={t('assetMore')}
                      title={t('assetMore')}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPreviewRef(ref);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          setPreviewRef(ref);
                        }
                      }}
                      className="absolute left-1/2 top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-background/75 text-foreground opacity-0 outline-none backdrop-blur-sm transition group-hover/thumb:opacity-100 focus-visible:opacity-100"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </span>
                  ) : null}

                  {/* 悬浮：右上角移除，压在白边框外沿上 */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t('remove')}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeVideoRef(ref.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        removeVideoRef(ref.id);
                      }
                    }}
                    className="absolute -right-1.5 -top-1.5 grid size-4 cursor-pointer place-items-center rounded-full bg-foreground text-background opacity-0 shadow-sm outline-none transition hover:brightness-90 group-hover/thumb:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-growth-accent/55"
                  >
                    <X className="size-2.5" strokeWidth={3} />
                  </span>
                </span>
              ))}
              {selectedVideoRefs.length < uploadLimit ? (
                <span className="grid size-14 shrink-0 place-items-center rounded-[10px] border border-dashed border-white/15 bg-white/5 text-foreground/45">
                  <Plus className="size-4" />
                </span>
              ) : null}
            </span>
          ) : (
            <>
              <span className="relative mb-2 inline-flex items-center justify-center -space-x-1.5">
                {[
                  { key: 'image', Icon: ImageIcon },
                  { key: 'video', Icon: Video },
                  { key: 'music', Icon: Music },
                ].map(({ key, Icon }, index) => (
                  <span
                    key={key}
                    className="growth-media-chip grid size-9 place-items-center rounded-full text-foreground/70 transition group-hover:text-foreground"
                    style={{ zIndex: index + 1 }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                ))}
              </span>
              <span className="relative text-sm font-semibold leading-none text-foreground/60">{t('uploadMedia')}</span>
              <span className="relative mt-1 block text-xs font-medium text-foreground/42">{t('uploadMediaHint')}</span>
            </>
          )}
        </button>

        {/* 这里不能用 <label>：<button> 属于 labelable 元素，点击 label 空白处会被浏览器
            转发给第一个可关联后代——原本是 textarea（正好是想要的行为），换成 contenteditable
            的 div 之后就变成了标题行里的模型选择按钮，点哪都会弹它的下拉。
            改用 div + 显式把焦点交给编辑器。 */}
        <div
          className="mt-2.5 block rounded-[13px] growth-panel-item p-3"
          onMouseDown={(event) => {
            // 只处理落在卡片空白处的点击；点在按钮/编辑器自身上时不抢焦点
            if (event.target !== event.currentTarget) return;
            event.preventDefault();
            promptEditorRef.current?.focus();
          }}
        >
          {/* 标题行：左侧 Prompt 标签，右侧是提示词优化的模型选择 + 优化按钮（等高） */}
          <span className="flex items-center gap-1.5">
            <span className="flex-1 text-xs font-bold text-foreground/42">{t('prompt')}</span>
            {textModels.length > 0 ? (
              <span className="min-w-0 shrink">
                <VideoOptionParamMenu
                  label={optimizeModelLabel}
                  title={t('optimizeModel')}
                  options={textModelOptions}
                  value={selectedTextModelId ?? ''}
                  onChange={onTextModelChange}
                  pill
                />
              </span>
            ) : null}
            <button
              type="button"
              aria-label={optimizing ? t('optimizing') : t('optimize')}
              title={optimizing ? t('optimizing') : t('optimize')}
              onClick={(e) => {
                e.preventDefault();
                void handleOptimize();
              }}
              disabled={optimizing}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] bg-growth-accent/15 text-growth-accent transition hover:bg-growth-accent/25 disabled:cursor-wait disabled:opacity-70"
            >
              {optimizing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <WandSparkles className="size-3" />
              )}
            </button>
          </span>
          <PromptMentionInput
            className="mt-1.5 min-h-[120px] w-full text-sm leading-6 text-foreground"
            placeholder={t('videoPromptPlaceholder')}
            value={prompt}
            onChange={setPrompt}
            items={mentionItems}
            emptyHint={t('mentionEmpty')}
            editorRef={promptEditorRef}
          />
          {/* 底部：生成参数类按钮（素材、音频…），全部小号黑底 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setMediaDialogOpen(true);
              }}
              className="inline-flex min-h-6 shrink-0 cursor-pointer items-center gap-1 rounded-[7px] bg-black/30 px-1.5 text-[11px] font-bold text-foreground/78 transition hover:bg-black/45 hover:text-foreground"
            >
              <AtSign className="size-3" />
              {t('elements')}
              {hasVideoRefs ? (
                <span className="text-growth-accent">{selectedVideoRefs.length}</span>
              ) : null}
            </button>
            {videoParams.supportsAudio ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setGenerateAudio((prev) => !prev);
                }}
                className={`inline-flex min-h-6 shrink-0 cursor-pointer items-center gap-1 rounded-[7px] px-1.5 text-[11px] font-bold transition ${generateAudio
                  ? 'bg-growth-accent/15 text-growth-accent hover:bg-growth-accent/25'
                  : 'bg-black/30 text-foreground/45 line-through hover:bg-black/45 hover:text-foreground/70'
                  }`}
              >
                <Volume2 className="size-3" />
                {t('audioOn')}
              </button>
            ) : null}
          </div>
          {optimizeError ? (
            <p className="mt-1.5 text-xs font-semibold text-destructive">{optimizeError}</p>
          ) : null}
        </div>

        <div className="mt-2.5 space-y-1.5">
          <VideoModelParamMenu
            label={modelLabel}
            models={videoModels}
            selectedModelId={selectedModelId}
            loading={modelsLoading}
            onChange={onModelChange}
            fallbackLabel={videoCapability.displayName}
          />
          <div className="grid grid-cols-3 gap-2">
            {/* 控件的**种类、顺序、是否出现**全部由选中模型的 paramsSchema 决定：
                - 顺序 = x-ui.order（各模型不同，例如 Seedance 是 分辨率→时长→比例，
                  VEO 是 分辨率→比例→时长→音频）
                - 种类 = x-ui.control（chips 离散选项 / stepper 连续区间 / switch 开关）
                schema 里没有的属性 = 该模型不支持，不渲染也不下发。 */}
            {videoParams.controls.map(({ key, control }) => {
              if (key === 'duration') {
                // 连续区间（stepper）与离散档位（chips）是两种控件，不能混用
                if (control === 'stepper' && videoParams.durationRange) {
                  return (
                    <VideoRangeParamMenu
                      key={key}
                      icon={<Clock3 className="size-4" />}
                      label={durationLabel}
                      title={t('durationLabel')}
                      min={videoParams.durationRange.min}
                      max={videoParams.durationRange.max}
                      step={videoParams.durationRange.step}
                      value={duration}
                      onChange={setDuration}
                    />
                  );
                }
                if (durationOptions.length === 0) return null;
                return (
                  <VideoSliderParamMenu
                    key={key}
                    icon={<Clock3 className="size-4" />}
                    label={durationLabel}
                    title={t('durationLabel')}
                    options={durationOptions}
                    value={duration}
                    onChange={setDuration}
                  />
                );
              }
              if (key === 'ratio') {
                if (ratioOptions.length === 0) return null;
                return (
                  <VideoOptionParamMenu
                    key={key}
                    icon={<AspectRatioIcon value={ratio} />}
                    label={ratioLabel}
                    title={t('aspectRatio')}
                    options={ratioOptions}
                    value={ratio}
                    onChange={setRatio}
                    renderOptionIcon={(value) => <AspectRatioIcon value={value} />}
                  />
                );
              }
              if (key === 'resolution') {
                if (resolutionOptions.length === 0) return null;
                return (
                  <VideoOptionParamMenu
                    key={key}
                    icon={<Diamond className="size-4" />}
                    label={resolution}
                    title={t('selectResolution')}
                    options={resolutionOptions}
                    value={resolution}
                    onChange={(value) => {
                      if ((videoParams.resolutions as string[]).includes(value)) {
                        setResolution(value as typeof resolution);
                      }
                    }}
                  />
                );
              }
              // generate_audio 的开关渲染在 Prompt 卡片底部，这里不重复
              return null;
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(217,217,217,0.04)] px-3 pb-3 pt-2.5 lg:shrink-0">
        <MagneticButton
          type="button"
          disabled={generating}
          onClick={() => void handleGenerate()}
          className="growth-generator-generate flex min-h-12 w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-[13px] bg-growth-accent px-4 text-sm font-black text-background hover:bg-foreground disabled:cursor-wait disabled:opacity-75"
        >
          <span className="inline-flex items-center gap-2">
            {generating ? t('generating') : t('generate')}
            <Sparkles className="size-4 fill-background" />
          </span>
          {generating ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-background/70">
              <Loader2 className="size-3 animate-spin" />
              {t('stayHere')}
            </span>
          ) : estimateCost != null ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-background/66">
              <Coins className="size-3.5" />
              {tImagePrompt('costPoints', { points: estimateCost })}
            </span>
          ) : null}
        </MagneticButton>
        {generateError ? (
          <p className="mt-2 rounded-[10px] border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs font-semibold text-destructive">
            {generateError}
          </p>
        ) : null}
      </div>
      {/* 缩略图放大预览 */}
      <Dialog open={Boolean(previewRef)} onOpenChange={(next) => { if (!next) setPreviewRef(null); }}>
        <DialogContent variant="fullscreen" className="grid place-items-center p-6">
          <DialogTitle className="sr-only">{previewRef?.name ?? ''}</DialogTitle>
          {previewRef ? (
            <img
              src={previewRef.url}
              alt={previewRef.name}
              className="max-h-[86vh] max-w-full rounded-[12px] object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 素材面板 portal 到右栏容器：面板覆盖右侧内容区，左侧操作栏仍可见可用。
          留在本组件的 React 树里，才能直接读写 selectedVideoRefs，无需把状态上提。 */}
      {assetPanelHost
        ? createPortal(
          <VideoAssetPanel
            open={mediaDialogOpen}
            onClose={() => setMediaDialogOpen(false)}
            selectedRefs={selectedVideoRefs}
            onChangeRefs={setSelectedVideoRefs}
            uploadLimit={uploadLimit}
          />,
          assetPanelHost,
        )
        : null}

    </aside>
  );
}
