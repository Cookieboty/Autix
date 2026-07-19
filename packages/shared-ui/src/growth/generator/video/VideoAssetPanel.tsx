'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Music,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  MaterialMembershipError,
  openBillingGate,
  useMaterialStore,
  type MaterialAsset,
  type MaterialAssetType,
} from '@autix/shared-store';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { AudioTrimDialog } from './AudioTrimDialog';
import { AudioWaveThumb } from './AudioWaveThumb';
import type { PublicVideoReference } from '../generator-studio-helpers';

/**
 * 素材选择面板：覆盖在右侧内容区上，三个 tab —— 我的上传 / 我生成的图 / 我生成的视频。
 *
 * 可上传与可选的媒体类型由 `allowedTypes` 决定，来源是模型 paramsSchema 里的
 * `x-media`（见 domain/video/input-media.ts 与 video-model-rules.ts）。
 * 10 个视频模型里只有 Seedance 两档和 Wan 2.7 真的接视频/音频输入，其余只接图片 ——
 * 给不接的模型开出上传入口，用户传上去必然失败。
 */

export type AssetPanelTab = 'uploads' | 'imageGen' | 'videoGen';

const TYPE_ACCEPT: Record<MediaType, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
};

type MediaType = 'image' | 'video' | 'audio';

/** 类型展示名复用筛选器已有词条（理由见 VideoSidebar 同名常量）。 */
const MEDIA_TYPE_LABEL_KEY = {
  image: 'assetFilterImages',
  video: 'assetFilterVideos',
  audio: 'assetFilterAudio',
} as const;

/** 默认允许的媒体类型。必须是模块级常量：写成参数默认值的数组字面量每次 render
 *  都是新引用，会让依赖它的 useCallback/useEffect 无限重跑（拉取永远停不下来）。 */
const DEFAULT_ALLOWED_TYPES: MediaType[] = ['image', 'video', 'audio'];

/** 媒体类型筛选项。后端 list 支持 `type` 参数，故这里是真筛选而非前端过滤 */
type TypeFilter = 'all' | MediaType;

const TYPE_FILTERS: Array<{
  value: TypeFilter;
  labelKey: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
    { value: 'all', labelKey: 'assetFilterAll', Icon: Layers },
    { value: 'image', labelKey: 'assetFilterImages', Icon: ImageIcon },
    { value: 'video', labelKey: 'assetFilterVideos', Icon: VideoIcon },
    { value: 'audio', labelKey: 'assetFilterAudio', Icon: Music },
  ];

/** 各类型时长上限的空缺省值。模块级常量：写成参数默认值的对象字面量每次 render 都是新引用。 */
const EMPTY_MAX_SECONDS: Partial<Record<MediaType, number>> = {};

/** 音频时长上限（秒）的兜底值；模型声明了 maxSeconds 时以声明为准。超过要先裁剪再上传。 */
const MAX_AUDIO_SECONDS = 15;

/**
 * 视频时长上限（秒）。
 *
 * 与音频不同，**这里不做裁剪**：浏览器没有原生视频编码能力，后端也没有 ffmpeg，
 * 可选路径（ffmpeg.wasm ~25MB / MediaRecorder 实时录制降质）代价都过高。
 * 因此超长视频照常上传，只在选中时提示用户自行处理。
 */
const MAX_VIDEO_SECONDS = 15;

/**
 * 读音频时长。用 <audio> 元数据而不是 decodeAudioData —— 后者要解完整段 PCM，
 * 几分钟的曲子会明显卡顿，而这里只需要一个时长来判断要不要弹裁剪框。
 */
function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    });
    audio.addEventListener('error', () => {
      cleanup();
      reject(new Error('audio metadata unavailable'));
    });
    audio.src = url;
  });
}

/** 秒 → m:ss */
function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function inferMaterialType(file: File): MaterialAssetType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function assetToReference(
  asset: MaterialAsset,
  sourceType: PublicVideoReference['sourceType'],
): PublicVideoReference {
  const mediaType: MediaType | undefined =
    asset.type === 'image' || asset.type === 'video' || asset.type === 'audio' ? asset.type : undefined;
  return {
    id: asset.id,
    url: asset.url,
    name: asset.title || asset.id,
    sourceType,
    sourceId: asset.id,
    mediaType,
  };
}

/**
 * 单个素材卡片。
 *
 * 外层用 div 而非 button：右上角的删除/放大是嵌套按钮，button 套 button 是非法 HTML，
 * 会触发 hydration 报错。整卡的选择热区用一个绝对定位的 button 铺满，操作按钮叠在它之上。
 */
function AssetTile({
  asset,
  selected,
  onToggle,
  onPreview,
  onDelete,
  deleting,
  canDelete,
  videoMaxSeconds,
}: {
  asset: MaterialAsset;
  selected: boolean;
  /** 视频会带上读到的时长（秒），供调用方判断是否超限 */
  onToggle: (durationSec?: number) => void;
  onPreview: () => void;
  onDelete: () => void;
  deleting: boolean;
  /** 只有「我的上传」允许删除；生成记录不在这里管理 */
  canDelete: boolean;
  /** 视频时长上限（秒）；undefined = 该模型没有时长限制，不标红 */
  videoMaxSeconds?: number;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  /** 视频时长，来自 <video preload="metadata"> 的元数据回调（不额外发请求） */
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoTooLong =
    videoMaxSeconds != null && videoDuration != null && videoDuration > videoMaxSeconds;
  const isAudio = asset.type === 'audio';
  const cover = asset.thumbnailUrl ?? (asset.type === 'image' ? asset.url : undefined);

  const toggleVideo = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => undefined);
      setVideoPlaying(true);
    } else {
      el.pause();
      setVideoPlaying(false);
    }
  };

  const toggleAudio = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => undefined);
      setAudioPlaying(true);
    } else {
      el.pause();
      setAudioPlaying(false);
    }
  };

  return (
    <div className="group relative aspect-square overflow-hidden rounded-[14px] bg-black/40">
      {isAudio ? (
        // 音频卡片：文件名 + 波形 + 右下角播放，没有可看的缩略图
        <div className="growth-panel-item flex size-full flex-col p-2">
          <span className="truncate text-[11px] font-semibold text-foreground/70">
            {asset.title || asset.id}
          </span>
          <AudioWaveThumb seed={asset.id} bars={22} className="min-h-0 flex-1 py-2" />
          <span className="flex justify-end">
            <span
              role="button"
              tabIndex={0}
              aria-label={audioPlaying ? t('trimAudioPause') : t('trimAudioPlay')}
              onClick={toggleAudio}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleAudio(event as unknown as ReactMouseEvent);
                }
              }}
              className="z-20 grid size-6 cursor-pointer place-items-center rounded-full bg-foreground text-background transition hover:brightness-90"
            >
              {audioPlaying ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
            </span>
          </span>
          <audio
            ref={audioRef}
            src={asset.url}
            preload="none"
            onEnded={() => setAudioPlaying(false)}
            className="hidden"
          />
        </div>
      ) : asset.type === 'video' ? (
        // 视频必须始终渲染 <video>，即使有封面也只能当 poster 用：
        // 走 <img> 分支会让 onLoadedMetadata 永不触发 → videoDuration 恒为 null →
        // 时长角标不显示、15s 上限拦截失效、播放按钮拿不到 ref 点了没反应。
        // 生成视频的 thumbnailUrl 由后端填充，此前必然命中这个坑。
        <video
          ref={videoRef}
          src={asset.url}
          poster={cover}
          muted
          playsInline
          preload="metadata"
          onEnded={() => setVideoPlaying(false)}
          onPause={() => setVideoPlaying(false)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value)) setVideoDuration(value);
          }}
          className="size-full object-cover"
        />
      ) : cover ? (
        <img src={cover} alt={asset.title ?? ''} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-foreground/30">
          <VideoIcon className="size-6" />
        </span>
      )}

      {/* 选择热区铺满整卡，z 低于右上角操作按钮 */}
      <button
        type="button"
        onClick={() => onToggle(videoDuration ?? undefined)}
        aria-pressed={selected}
        aria-label={asset.title ?? ''}
        className="absolute inset-0 z-10 cursor-pointer"
      />

      {/* 视频时长；超过上限时标红，选中前就能看出来 */}
      {videoDuration != null ? (
        <span
          className={`pointer-events-none absolute left-1.5 top-1.5 z-20 rounded px-1 py-0.5 text-[9px] font-bold backdrop-blur-sm ${videoTooLong ? 'bg-destructive text-white' : 'bg-background/60 text-foreground/85'
            }`}
        >
          {formatSeconds(videoDuration)}
        </span>
      ) : null}

      {/* 选中：左下角角标，贴死边角（外角跟随卡片圆角，内角小圆角），不是悬浮的圆形勾选框 */}
      {selected ? (
        <span className="pointer-events-none absolute bottom-0 left-0 z-20 grid size-4 place-items-center rounded-bl-[14px] rounded-tr-[7px] bg-growth-accent text-background">
          <Check className="size-2.5" strokeWidth={3.5} />
        </span>
      ) : null}

      {/* 视频播放按钮：与音频卡片同款（右下角、白底深色图标），两种媒体的播放入口保持一致。
          必须 stopPropagation —— 下面铺着整卡的选择热区，不拦会连带切换选中态。 */}
      {asset.type === 'video' ? (
        <span
          role="button"
          tabIndex={0}
          aria-label={videoPlaying ? t('trimAudioPause') : t('trimAudioPlay')}
          onClick={toggleVideo}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleVideo(event as unknown as ReactMouseEvent);
            }
          }}
          className="absolute bottom-2 right-2 z-20 grid size-6 cursor-pointer place-items-center rounded-full bg-foreground text-background transition hover:brightness-90"
        >
          {videoPlaying ? (
            <Pause className="size-3 fill-current" />
          ) : (
            <Play className="size-3 translate-x-px fill-current" />
          )}
        </span>
      ) : null}

      {/* 悬浮操作：删除 / 放大 */}
      <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        {canDelete ? (
          <button
            type="button"
            aria-label={t('assetDelete')}
            title={t('assetDelete')}
            disabled={deleting}
            onClick={onDelete}
            className="grid size-6 cursor-pointer place-items-center rounded-full bg-background/70 text-foreground/85 backdrop-blur-sm transition hover:bg-destructive hover:text-white disabled:cursor-wait"
          >
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </button>
        ) : null}
        {/* 音频没有可放大的画面，只留删除 */}
        {isAudio ? null : (
          <button
            type="button"
            aria-label={t('assetPreview')}
            title={t('assetPreview')}
            onClick={onPreview}
            className="grid size-6 cursor-pointer place-items-center rounded-full bg-background/70 text-foreground/85 backdrop-blur-sm transition hover:bg-background hover:text-foreground"
          >
            <Maximize2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function VideoAssetPanel({
  open,
  onClose,
  selectedRefs,
  onChangeRefs,
  uploadLimit,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxSecondsOf = EMPTY_MAX_SECONDS,
  maxOf,
}: {
  open: boolean;
  onClose: () => void;
  selectedRefs: PublicVideoReference[];
  onChangeRefs: (next: PublicVideoReference[]) => void;
  uploadLimit: number;
  /** 允许上传/选择的媒体类型，由模型 paramsSchema 的 x-media 决定（见 video-model-rules）。 */
  allowedTypes?: MediaType[];
  /**
   * 各类型的单个素材时长上限（秒）。缺省 = 上游没写限制，不拦。
   * 此前这里是两个写死的 15 —— 那其实是 Seedance 的规则，对别的模型没有意义。
   */
  maxSecondsOf?: Partial<Record<MediaType, number>>;
  /** 各类型的数量上限，用于选中时的分类型拦截。 */
  maxOf?: Record<MediaType, number>;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const loadMaterials = useMaterialStore((s) => s.loadMaterials);
  const uploadMaterialFiles = useMaterialStore((s) => s.uploadMaterialFiles);
  const deleteMaterial = useMaterialStore((s) => s.deleteMaterial);

  /** 该模型的有效时长上限：模型声明优先，没声明就退回历史默认（Seedance 的 15s）。 */
  const videoMaxSeconds = maxSecondsOf.video ?? MAX_VIDEO_SECONDS;
  const audioMaxSeconds = maxSecondsOf.audio ?? MAX_AUDIO_SECONDS;

  const [tab, setTab] = useState<AssetPanelTab>('uploads');
  const [assets, setAssets] = useState<MaterialAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<'load' | 'upload' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MaterialAsset | null>(null);
  /** 待裁剪的超长音频队列，逐个弹框处理 */
  const [trimQueue, setTrimQueue] = useState<File[]>([]);
  /** 刚选中的超长视频名；非空时在卡片顶部显示提示 */
  const [tooLongName, setTooLongName] = useState<string | null>(null);
  /** 某一类已选满时的提示。存类型 key（image/video/audio）而不是本地化后的名字 —— 后者拿不回上限数值。 */
  const [typeFull, setTypeFull] = useState<MediaType | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** 取数请求序号，用于丢弃「后发先至」的过期结果 */
  const fetchSeqRef = useRef(0);
  /**
   * selectedRefs 的最新快照。上传/删除都在 await 之后才回写选中集，
   * 直接用闭包捕获的值会把这期间用户新选的素材静默丢掉。
   */
  const selectedRefsRef = useRef(selectedRefs);
  selectedRefsRef.current = selectedRefs;

  // 调用方若传内联数组同样会每次变引用，这里用字符串 key 归一后再派生
  const allowedKey = allowedTypes.join(',');
  const allowed = useMemo(() => allowedKey.split(',') as MediaType[], [allowedKey]);
  const allowsVideo = allowed.includes('video');
  // 模型不接受视频输入时，Video Generations tab 没有意义
  const tabs = useMemo(
    () =>
      [
        { key: 'uploads' as const, label: t('assetTabUploads') },
        { key: 'imageGen' as const, label: t('assetTabImageGen') },
        ...(allowsVideo ? [{ key: 'videoGen' as const, label: t('assetTabVideoGen') }] : []),
      ],
    [allowsVideo, t],
  );

  // 当前 tab 被隐藏时回落到第一个
  useEffect(() => {
    if (!tabs.some((item) => item.key === tab)) setTab('uploads');
  }, [tab, tabs]);

  const fetchAssets = useCallback(async () => {
    // 请求序号：快速切 tab / 改筛选时，先发的请求可能后返回。没有这道判断的话，
    // 旧结果会覆盖新结果，而 canDelete、sourceType 都按「当前」tab 计算 ——
    // 于是生成素材上冒出删除按钮、选中的素材被打上错误的来源类型。
    const requestId = ++fetchSeqRef.current;
    const isStale = () => requestId !== fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const params =
        tab === 'uploads'
          ? {
            librarySource: 'UPLOAD' as const,
            pageSize: 60,
            // 选了具体类型就交给后端筛（走 type 参数），选 all 时仍拉全部
            ...(typeFilter === 'all' ? {} : { type: typeFilter }),
          }
          : tab === 'imageGen'
            ? { librarySource: 'GENERATION' as const, type: 'image' as const, pageSize: 60 }
            : { librarySource: 'GENERATION' as const, type: 'video' as const, pageSize: 60 };
      const list = await loadMaterials(params);
      if (isStale()) return;
      // 再按当前模型允许的类型兜一层：后端返回里可能有模型不接受的类型
      setAssets(
        tab === 'uploads'
          ? list.filter((item) => allowed.includes(item.type as MediaType))
          : list,
      );
    } catch {
      if (isStale()) return;
      setError('load');
      setAssets([]);
    } finally {
      // 只有最新那次请求才有资格收起骨架屏
      if (!isStale()) setLoading(false);
    }
  }, [allowed, loadMaterials, tab, typeFilter]);

  useEffect(() => {
    if (!open) return;
    void fetchAssets();
  }, [fetchAssets, open]);

  // Esc 关闭。与外部点击同样要让位给子弹框：Radix Dialog 处理 Escape 后
  // 不阻止原生事件继续冒泡，不加这道判断的话按 Esc 会把预览/裁剪框和面板一起关掉。
  useEffect(() => {
    if (!open || previewAsset || trimQueue.length > 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open, previewAsset, trimQueue.length]);

  // 点击面板外部关闭。
  // 用 mousedown 而非 click：click 要等 mouseup，期间若目标元素被重渲染移除，
  // 事件根本不会派发到 document，面板就关不掉。
  //
  // 放大预览与音频裁剪都是 portal 到 body 的 Dialog，DOM 上不在面板内，会被判成
  // "外部点击"。两道防线：有子弹框时整体跳过；再对落在任意 [role=dialog] 内的
  // 点击放行（Radix 会给 DialogContent 打这个 role），避免以后新增弹框又踩一次。
  useEffect(() => {
    if (!open || previewAsset || trimQueue.length > 0) return;
    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (root.contains(target)) return;
      if (target.closest?.('[role="dialog"]')) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose, open, previewAsset, trimQueue.length]);

  const selectedIds = useMemo(
    () => new Set(selectedRefs.map((ref) => ref.sourceId ?? ref.id)),
    [selectedRefs],
  );

  const toggleAsset = (asset: MaterialAsset, durationSec?: number) => {
    const key = asset.id;
    if (selectedIds.has(key)) {
      onChangeRefs(selectedRefs.filter((ref) => (ref.sourceId ?? ref.id) !== key));
      setTooLongName(null);
      setTypeFull(null);
      return;
    }
    // 超长视频不允许选中：裁剪需要 ffmpeg 级能力，前后端都不具备，
    // 与其让它进生成请求再被上游拒掉，不如在这里拦住并说明原因。
    if (asset.type === 'video' && durationSec != null && durationSec > videoMaxSeconds) {
      setTooLongName(asset.title || asset.id);
      return;
    }
    // 分类型的数量上限：不同模型对图/视频/音频各有各的上限（Seedance 图 9 / 视频 3 / 音频 3，
    // Grok 1.5 恰好 1 张图）。只看总数会让用户在「还没到总上限」时把某一类塞爆，
    // 请求发出去才被上游拒。
    const perTypeMax = maxOf?.[asset.type as MediaType];
    if (perTypeMax !== undefined) {
      const selectedOfType = selectedRefs.filter((ref) => ref.mediaType === asset.type).length;
      if (selectedOfType >= perTypeMax) {
        setTypeFull(asset.type as MediaType);
        return;
      }
    }
    setTypeFull(null);
    setTooLongName(null);
    const sourceType: PublicVideoReference['sourceType'] =
      tab === 'uploads' ? 'library' : tab === 'imageGen' ? 'image_generation' : 'video_generation';
    // 超过上限时丢掉最早选的，与侧栏 mergePublicVideoReferences 的截断方向一致
    const next = [...selectedRefs, assetToReference(asset, sourceType)];
    onChangeRefs(next.slice(-uploadLimit));
  };

  /** 从素材库真删（软删），同时把它从已选里摘掉——否则会留下一个指向已删素材的引用 */
  const handleDelete = async (asset: MaterialAsset) => {
    setDeletingId(asset.id);
    try {
      await deleteMaterial(asset.id);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      onChangeRefs(selectedRefsRef.current.filter((ref) => (ref.sourceId ?? ref.id) !== asset.id));
    } catch {
      setError('load');
    } finally {
      setDeletingId(null);
    }
  };

  /** 真正执行上传（音频超长的已在上层裁剪过） */
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const created = await uploadMaterialFiles(
        files.map((file) => ({ type: inferMaterialType(file), file, sourceType: 'upload' as const })),
      );
      // 上传即选中，省一次点击
      const refs = created.map((asset) => assetToReference(asset, 'library'));
      onChangeRefs([...selectedRefsRef.current, ...refs].slice(-uploadLimit));
      await fetchAssets();
    } catch (error) {
      // 非会员被后端 403 拦下 → 直接唤起付费弹框，不在面板里显示一句干巴巴的报错
      if (error instanceof MaterialMembershipError) {
        openBillingGate({ msg: error.reason ?? t('assetUploadFailed') });
      } else {
        setError('upload');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * 选文件入口：音频超过上限的先挑出来排队裁剪，其余直接上传。
   * 裁剪是逐个走弹框的，所以用队列而不是一次性并发。
   */
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList).filter((file) =>
      allowed.includes(inferMaterialType(file) as MediaType),
    );
    if (files.length === 0) return;

    const overLong: File[] = [];
    const direct: File[] = [];
    for (const file of files) {
      if (inferMaterialType(file) === 'audio') {
        const seconds = await readAudioDuration(file).catch(() => 0);
        // 读不出时长（编码不支持）就按原样传，交给后端校验，不要卡住用户
        if (seconds > audioMaxSeconds) {
          overLong.push(file);
          continue;
        }
      }
      direct.push(file);
    }

    if (direct.length > 0) await uploadFiles(direct);
    // 追加而非覆盖：上一批还没裁完时又选了新文件，覆盖会让剩余的永久丢失
    if (overLong.length > 0) setTrimQueue((queue) => [...queue, ...overLong]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  const accept = allowed.map((type) => TYPE_ACCEPT[type]).join(',');

  return (
    <div ref={rootRef} className="growth-sheet-shadow absolute left-0 top-0 z-40 flex max-h-[min(560px,100%)] w-[min(480px,100%)] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(35,38,42,0.85)] p-2 backdrop-blur-[40px]">
      {/* 顶部：tab 直接坐在面板底上（无容器框），选中态是白色胶囊 */}
      <div className="flex shrink-0 items-center gap-1 pb-2">
        <div className="hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-xs font-bold transition ${tab === item.key
                ? 'bg-white text-background'
                : 'text-foreground hover:bg-white/10'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-[11px] font-bold text-foreground/40">
          {selectedRefs.length}/{uploadLimit}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-foreground/70 transition hover:bg-white/20 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 内容卡片 */}
      {/* 高度跟内容走：不设 flex-1（否则会撑满 max-h 留下大片空白），
          只留 min-h-0 让它在超过面板 max-h 时能收缩并内部滚动。 */}
      <div className="growth-dark-scrollbar min-h-0 overflow-y-auto rounded-[18px] bg-[#313337] p-2">
        {/* 卡片内标题行 + 分割线。
            -mx-2 抵消卡片的 p-2，让分割线通到卡片左右两边，不被内边距截断；
            线色取弹框底色，看起来像卡片被"切开"露出下层。 */}
        <div className="-mx-2 mb-2 flex items-center gap-2 border-b border-[rgb(35,38,42)] px-3 pb-2">
          <span className="flex-1 text-xs font-semibold text-foreground/45">
            {tabs.find((item) => item.key === tab)?.label}
          </span>
          {/* 媒体类型筛选。只列该模型允许的类型，Image/Video Gen tab 类型固定故不展示 */}
          {tab === 'uploads' && allowed.length > 1 ? (
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex min-h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-[11px] font-bold text-foreground transition hover:bg-white/20"
                >
                  <SlidersHorizontal className="size-3" />
                  {t('assetFilter')}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-44 gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.92)] p-1.5 text-foreground backdrop-blur-[32px]"
              >
                <div className="px-2.5 py-1.5 text-xs font-semibold text-foreground/45">
                  {t('assetFilterBy')}
                </div>
                {TYPE_FILTERS.filter(
                  (option) => option.value === 'all' || allowed.includes(option.value as MediaType),
                ).map((option) => {
                  const active = typeFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTypeFilter(option.value);
                        setFilterOpen(false);
                      }}
                      className={`flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-semibold transition ${active ? 'bg-white/[0.06] text-foreground' : 'text-foreground/82 hover:bg-white/[0.04]'
                        }`}
                    >
                      <option.Icon className="size-3.5 shrink-0 text-foreground/70" />
                      <span className="min-w-0 flex-1 truncate">{t(option.labelKey)}</span>
                      {active ? <Check className="size-4 shrink-0 text-growth-accent" /> : null}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
        {error ? (
          <p className="mb-2.5 rounded-[14px] bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            {error === 'load' ? t('assetLoadFailed') : t('assetUploadFailed')}
          </p>
        ) : null}

        {/* 超长视频提示：不阻断选择，只告知需要自行处理 */}
        {typeFull ? (
          <div className="mb-2.5 flex items-start gap-2 rounded-[14px] bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {t('mediaTypeFull', { type: t(MEDIA_TYPE_LABEL_KEY[typeFull]), max: maxOf?.[typeFull] ?? 0 })}
            </span>
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => setTypeFull(null)}
              className="shrink-0 cursor-pointer opacity-70 transition hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {tooLongName ? (
          <div className="mb-2.5 flex items-start gap-2 rounded-[14px] bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {t('videoTooLong', { seconds: videoMaxSeconds, name: tooLongName })}
            </span>
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => setTooLongName(null)}
              className="shrink-0 cursor-pointer opacity-70 transition hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {/* 加载态与内容共用同一个网格：上传入口始终渲染，骨架屏只填它后面的格子，
            不会把上传按钮盖住。 */}
        <div className="grid grid-cols-4 gap-2">
          {/* 上传入口只在 Uploads tab */}
          {tab === 'uploads' ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                // 横跨 2 格。不设 aspect：高度由同排方形缩略图撑出的行高决定（grid 默认 stretch），
                // min-h 只是"这排没有缩略图"时的兜底，避免塌成一条。
                className="growth-panel-item col-span-2 grid min-h-[110px] cursor-pointer place-items-center rounded-[14px] border border-dashed text-foreground/45 transition hover:border-white/25 hover:text-foreground disabled:cursor-wait"
              >
                <span className="flex flex-col items-center gap-1.5">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                  <span className="text-[11px] font-bold">{t('uploadMedia')}</span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
            </>
          ) : null}

          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="growth-skeleton aspect-square rounded-[14px]" />
            ))
            : assets.map((asset) => (
              <AssetTile
                key={asset.id}
                asset={asset}
                selected={selectedIds.has(asset.id)}
                onToggle={(durationSec) => toggleAsset(asset, durationSec)}
                onPreview={() => setPreviewAsset(asset)}
                onDelete={() => void handleDelete(asset)}
                deleting={deletingId === asset.id}
                canDelete={tab === 'uploads'}
                videoMaxSeconds={videoMaxSeconds}
              />
            ))}

          {/* 空态横跨整行居中。Uploads tab 不显示——那里本来就有上传入口占位，
              再叠一句"还没有内容"既多余又会把上传按钮挤到角落。 */}
          {!loading && assets.length === 0 && tab !== 'uploads' ? (
            <div className="col-span-full grid min-h-[180px] place-items-center">
              <p className="text-sm text-foreground/40">{t('assetEmpty')}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* 超长音频裁剪：队列取第一个，处理完出队，队列空了自动关闭 */}
      <AudioTrimDialog
        file={trimQueue[0] ?? null}
        maxSeconds={audioMaxSeconds}
        onCancel={() => setTrimQueue((queue) => queue.slice(1))}
        onConfirm={(trimmed) => {
          setTrimQueue((queue) => queue.slice(1));
          void uploadFiles([trimmed]);
        }}
      />

      {/* 放大预览：复用 ui/dialog 的 fullscreen 变体 */}
      <Dialog open={Boolean(previewAsset)} onOpenChange={(next) => { if (!next) setPreviewAsset(null); }}>
        <DialogContent variant="fullscreen" className="grid place-items-center p-6">
          <DialogTitle className="sr-only">{previewAsset?.title ?? ''}</DialogTitle>
          {previewAsset ? (
            previewAsset.type === 'video' ? (
              <video
                src={previewAsset.url}
                controls
                autoPlay
                playsInline
                className="max-h-[86vh] max-w-full rounded-[12px]"
              />
            ) : previewAsset.type === 'audio' ? (
              <audio src={previewAsset.url} controls autoPlay className="w-[min(560px,90vw)]" />
            ) : (
              <img
                src={previewAsset.url}
                alt={previewAsset.title ?? ''}
                className="max-h-[86vh] max-w-full rounded-[12px] object-contain"
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
