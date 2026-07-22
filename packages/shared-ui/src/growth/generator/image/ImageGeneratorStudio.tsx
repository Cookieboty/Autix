'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ImageModelCapability } from '@autix/domain/image';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import {
  galleryActions,
  publicGalleryActions,
  publicGeneratorActions,
  setBillingGateContext,
  useAuthStore,
  useUiStore,
  type GalleryFeedItem,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import { resolveTemplatePrompt } from '../media-inputs';
import { GalleryDetailDialog } from '../../detail/GalleryDetailDialog';
import { useGalleryPostModal } from '../../detail/useGalleryPostModal';
import type { PublicGrowthMediaItem } from '../../types';
import { ModeTabs, StudioDensitySlider } from '../parts';
import type {
  ImageStudioMode,
  PublicUploadedReference,
  TemplateDensity,
} from '../generator-studio-helpers';
import { ImageComposer } from './ImageComposer';
import { resolveFavoriteAction, resolveLikeAction } from './gallery-interaction-model';
import { PublicImageTemplateWall, type GalleryCardInteraction } from './ImageTemplateWall';
import { PublicImageHistoryPanel, type PendingImageGenerationCard } from './PublicImageHistoryPanel';
import { buildStudioSearch, parseStudioMode } from './gallery-url';
import {
  buildPublicImageHistoryItems,
  type PublicImageGenerationPayload,
  type PublicImageHistoryImage,
  type PublicImageHistoryItem,
} from './public-image-generation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';

/** 广场墙每页条数：首屏与续页同宽，首屏这批同时也是唯一播入场动画的一批。 */
const GALLERY_PAGE_SIZE = 30;

/**
 * 广场作品 → 模板卡片形状映射：只填模板墙/详情弹窗实际读取的字段，
 * description 充当 prompt（"使用"即把描述填入生成器）。其余模板专有字段留空。
 *
 * 不再 `as unknown as ImageTemplate` —— 那个强转正是 liked/favorited 被悄悄丢掉却没被
 * 类型检查抓住的原因。这里显式声明返回一个「补齐了必填字段」的卡片对象。
 */
function galleryItemToTemplateCard(item: GalleryFeedItem): ImageTemplate {
  const { post, metrics } = item;
  const cover = post.coverImage ?? post.mediaUrls[0] ?? '';
  const card: Partial<ImageTemplate> = {
    id: post.id,
    // 广场无标题
    title: '',
    prompt: post.prompt ?? post.description ?? '',
    coverImage: cover,
    exampleImages: post.mediaUrls,
    authorName: item.author?.nickname ?? '',
    authorUrl: item.author?.avatar ?? '',
    category: post.category,
    likeCount: metrics.likeCount,
    viewCount: metrics.viewCount,
    useCount: 0,
    // 卡片上展示别名；厂商串仍在 feed 的 post.model 里（详情/跳转用）
    modelHint: post.modelName ?? post.model ?? '',
  };
  return card as ImageTemplate;
}

/**
 * feed → 卡片宽高比（width/height）：瀑布流分列要靠它估列高。
 * 优先用 post.width/height，退而解析 aspectRatio 串（"3:4"/"1024x1536"），都没有则返回
 * undefined 交给墙那边按竖图兜底——这两个字段之前在卡片映射里被丢掉了。
 */
function galleryItemToAspectRatio(item: GalleryFeedItem): number | undefined {
  const { width, height, aspectRatio } = item.post;
  if (width && height && width > 0 && height > 0) return width / height;
  const match = aspectRatio?.match(/(\d+)\s*[x:×]\s*(\d+)/i);
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return undefined;
}

/** 一页 feed 的宽高比表；比例解析不出来的直接不进表，由墙那边兜底。 */
function collectAspectRatios(items: GalleryFeedItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    const ratio = galleryItemToAspectRatio(item);
    if (ratio) map[item.post.id] = ratio;
  }
  return map;
}

/** SDK 会把服务端 envelope 的 `code` 平铺到 Error 对象上（见 client-core interceptor）。 */
function extractErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const raw = (err as { code?: unknown }).code;
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

/**
 * 从被拒绝的并发请求错误里读回 `{ concurrency, activeCount, requestedCount }`
 * —— 后端把它塞在 exception body 的 `data` 里，AllExceptionsFilter 会平铺到
 * response envelope 的 data 字段，SDK 再把整个 data 塞到 error.data。
 */
function extractConcurrencyDetails(err: unknown): {
  concurrency: number;
  activeCount: number;
  requestedCount: number;
} {
  const fallback = { concurrency: 0, activeCount: 0, requestedCount: 0 };
  if (!err || typeof err !== 'object' || !('data' in err)) return fallback;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return fallback;
  const record = data as Record<string, unknown>;
  return {
    concurrency:
      typeof record.concurrency === 'number' ? record.concurrency : fallback.concurrency,
    activeCount:
      typeof record.activeCount === 'number' ? record.activeCount : fallback.activeCount,
    requestedCount:
      typeof record.requestedCount === 'number' ? record.requestedCount : fallback.requestedCount,
  };
}

/** feed → 互动态：登录态才有 liked/favorited（匿名是 undefined，不是 false）。 */
function galleryItemToInteraction(item: GalleryFeedItem): GalleryCardInteraction {
  return {
    liked: item.liked ?? false,
    favorited: item.favorited ?? false,
    likeCount: item.metrics.likeCount,
  };
}

export function ImageGeneratorStudio({
  items,
  imageCapability,
  imageModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  paramsSchema,
  pricingSchema,
  pricingContext,
  onModelChange,
  initialMode = 'history',
  initialPrompt,
  syncUrl = false,
}: {
  items: PublicGrowthMediaItem[];
  imageCapability: ImageModelCapability;
  imageModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  /** image_generation 的 TaskModel schema（pricingActions.getTaskModels），逐级透传给 ImageComposer。 */
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  onModelChange: (modelId: string) => void;
  initialMode?: ImageStudioMode;
  /** Plan C Task 12：广场「recreate」跳转预填 prompt——复用 appliedTemplate 机制，仅挂载时应用一次。 */
  initialPrompt?: string | null;
  /**
   * 把 Tab / 广场详情写进浏览器地址栏（pushState，不刷新页面）。Web 端开；桌面端是
   * HashRouter、地址栏对用户不可见，开了没意义。
   */
  syncUrl?: boolean;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [mode, setMode] = useState<ImageStudioMode>(initialMode);
  const galleryMode = mode === 'gallery';
  const [templateDensity, setTemplateDensity] = useState<TemplateDensity>('normal');
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  // 初值为 true：数据请求在 effect 里才发起，初值给 false 的话首帧会先渲染一遍「无数据」，
  // 下一帧才切到加载态——表现就是刷新时空状态闪一下。进页面就该是加载中。
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesLoadingMore, setTemplatesLoadingMore] = useState(false);
  const [templatesCursor, setTemplatesCursor] = useState<string | null>(null);
  /** 卡片宽高比（id → width/height）：瀑布流分列估列高用；只增不改，保证已落位的卡不换列 */
  const [templateAspects, setTemplateAspects] = useState<Record<string, number>>({});
  const [interactions, setInteractions] = useState<Record<string, GalleryCardInteraction>>({});
  const [historyItems, setHistoryItems] = useState<PublicImageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pendingGenerations, setPendingGenerations] = useState<PendingImageGenerationCard[]>([]);
  /**
   * 广场作品的原始 feed（按 postId 索引）。瀑布流卡片吃的是映射后的 ImageTemplate，
   * 但详情弹窗与首页共用、吃的是 GalleryFeedItem 原始形状 —— 映射会丢掉 metrics /
   * tags / width·height 等字段，所以原件必须留着。
   */
  const [galleryFeed, setGalleryFeed] = useState<Record<string, GalleryFeedItem>>({});
  const [historySelectionActive, setHistorySelectionActive] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const [appliedTemplate, setAppliedTemplate] = useState<{
    id: string;
    title: string;
    prompt: string;
  } | null>(null);
  /** 历史详情弹窗点 Reference 后要塞回输入框的参考图（每次换新 id，Composer 据此追加）。 */
  const [appliedReference, setAppliedReference] = useState<PublicUploadedReference | null>(null);
  /** Recreate 指令：把 prompt + 参考图带回输入框（模型由父级切换）。每次换新 id。 */
  const [appliedRecreate, setAppliedRecreate] = useState<{
    id: string;
    prompt: string;
    referenceImages: string[];
  } | null>(null);
  /**
   * 并发超限弹窗上下文。后端在 body.data 里给了会员等级实际的 concurrency 上限、当前
   * 在途张数、以及本次请求的张数，全部展示给用户，方便一眼看清「多点了几张」。null
   * 表示不显示。
   */
  const [concurrencyModal, setConcurrencyModal] = useState<{
    limit: number;
    active: number;
    requested: number;
  } | null>(null);

  /**
   * 广场作品详情：**本地弹窗 + 只改地址栏**（不做路由导航）。
   *
   * feed 里已经有这条作品的完整数据，直接开弹窗、零请求、瞬开；地址栏由 History API
   * 改成 /gallery/<id>，刷新时才由那条真实路由渲染完整页。
   */
  const galleryModal = useGalleryPostModal();

  const openGalleryPost = (template: ImageTemplate) => {
    const item = galleryFeed[template.id];
    if (item) galleryModal.open(item);
  };

  /** 切 Tab：写进地址栏（replace，不留历史记录——切 Tab 不该占一条「后退」）。 */
  const changeMode = (next: ImageStudioMode) => {
    setMode(next);
    if (!syncUrl || typeof window === 'undefined') return;
    // 原生 History API 而不是 router.replace：后者会走一趟服务端、整页重挂载，
    // 正在生成的任务和输入框内容都会没。切 Tab 只要地址栏变，不要导航。
    const search = buildStudioSearch(window.location.search, next);
    window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  };

  // 浏览器前进/后退：地址栏里的 ?mode= 是 Tab 的真相来源
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    const handlePopState = () => setMode(parseStudioMode(window.location.search));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncUrl]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    // 数据源改为广场（gallery_posts）已发布作品；沿用模板墙/详情弹窗的交互，
    // 把广场作品映射成模板卡片形状（description 充当 prompt）。
    publicGalleryActions
      .listFeed({ kind: 'IMAGE', limit: GALLERY_PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setTemplates(page.items.map(galleryItemToTemplateCard));
        setInteractions(
          Object.fromEntries(
            page.items.map((item) => [item.post.id, galleryItemToInteraction(item)]),
          ),
        );
        setGalleryFeed(Object.fromEntries(page.items.map((item) => [item.post.id, item])));
        setTemplateAspects(collectAspectRatios(page.items));
        setTemplatesCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) {
          setTemplates([]);
          setInteractions({});
          setTemplateAspects({});
          setTemplatesCursor(null);
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 触底加载下一页。游标为空即到底；失败时清掉游标止损，避免哨兵反复重试打爆接口。 */
  const loadMoreTemplates = useCallback(() => {
    if (!templatesCursor || templatesLoadingMore) return;
    setTemplatesLoadingMore(true);
    publicGalleryActions
      .listFeed({ kind: 'IMAGE', limit: GALLERY_PAGE_SIZE, cursor: templatesCursor })
      .then((page) => {
        setTemplates((prev) => {
          // 热度排序下游标翻页可能回吐已见过的帖子，按 id 去重，否则 React key 会撞
          const seen = new Set(prev.map((template) => template.id));
          const next = page.items
            .map(galleryItemToTemplateCard)
            .filter((template) => !seen.has(template.id));
          return next.length ? [...prev, ...next] : prev;
        });
        setInteractions((prev) => ({
          ...prev,
          ...Object.fromEntries(
            page.items
              .filter((item) => !(item.post.id in prev))
              .map((item) => [item.post.id, galleryItemToInteraction(item)]),
          ),
        }));
        setGalleryFeed((prev) => ({
          ...prev,
          ...Object.fromEntries(page.items.map((item) => [item.post.id, item])),
        }));
        setTemplateAspects((prev) => ({ ...collectAspectRatios(page.items), ...prev }));
        setTemplatesCursor(page.nextCursor);
      })
      .catch(() => {
        setTemplatesCursor(null);
      })
      .finally(() => {
        setTemplatesLoadingMore(false);
      });
  }, [templatesCursor, templatesLoadingMore]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setHistoryItems([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const items = await publicGeneratorActions.listImageHistory({ pageSize: 30 });
      setHistoryItems(
        items.map((item) => ({
          id: item.id,
          prompt: item.resolvedPrompt,
          model: item.modelUsed,
          createdAt: item.createdAt,
          galleryPost: item.galleryPost,
          modelConfigId: item.modelConfigId ?? null,
          referenceImages: (item.referenceImages ?? []).map((ref) => ref.url),
          // settings 是透传 bag（spec §11 第 2 期），这里原样带过来，不要挑字段重捏：
          // 比例参数的键名逐模型不同（多数模型是 aspectRatio，只有 size-grid 模型才有
          // size），之前只摘 { size, quality } 会把 aspectRatio 整个丢掉——历史图因此
          // 全部退化成 1:1、详情里的 Size 显示 "-"。
          settings: item.settings ?? {},
          images: (item.images?.length
            ? item.images
            : item.generatedImages.map((url, index) => ({
                url,
                index,
                prompt: item.resolvedPrompt,
                generationId: item.id,
              }))
          ).map((image, index) => ({
            url: image.url,
            prompt: image.prompt ?? item.resolvedPrompt,
            generationId: image.generationId ?? item.id,
            index: image.index ?? index,
          })),
        })),
      );
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /** 刷新后从后端反查未终态图片任务并合并为骨架卡；有活跃任务时以 5s 间隔轮询。 */
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const restoredIdsRef = { current: new Set<string>() };

    const buildRestoredCard = (task: {
      id: string;
      prompt: string;
      model: string;
      settings: Record<string, unknown>;
    }): PendingImageGenerationCard => ({
      id: `restored-image-${task.id}`,
      prompt: task.prompt,
      model: task.model,
      count: 1,
      settings: task.settings,
    });

    const pull = async (): Promise<boolean> => {
      try {
        const active = await publicGeneratorActions.listActiveImageTasks();
        if (cancelled) return false;
        const nextIds = new Set(active.map((task) => task.id));
        const disappeared = [...restoredIdsRef.current].filter((id) => !nextIds.has(id));
        restoredIdsRef.current = nextIds;

        // 先 await history 拿到成品再抹骨架，避免"骨架消失→图片出现"的中间空窗。
        if (disappeared.length > 0) {
          await loadHistory();
          if (cancelled) return false;
        }

        setPendingGenerations((prev) => {
          const preserved = prev.filter((card) => !card.id.startsWith('restored-image-'));
          // 本地乐观骨架（pending-image-*）已覆盖进行中的生成；restored 只补本地未覆盖的
          // 活跃任务（典型是刷新后本地状态丢失），避免同一任务出现双份骨架。
          const localPendingCount = preserved.filter((card) =>
            card.id.startsWith('pending-image-'),
          ).length;
          const restoredNeeded = Math.max(0, active.length - localPendingCount);
          const restored = active.slice(0, restoredNeeded).map(buildRestoredCard);
          return [...restored, ...preserved];
        });

        return active.length > 0;
      } catch {
        return false;
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      timerId = setTimeout(async () => {
        timerId = null;
        const hasActive = await pull();
        if (!cancelled && hasActive) scheduleNext();
      }, 5000);
    };

    const primeAndMaybePoll = async () => {
      const hasActive = await pull();
      if (!cancelled && hasActive) scheduleNext();
    };

    const handleVisibility = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        void primeAndMaybePoll();
      }
    };

    void primeAndMaybePoll();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [isAuthenticated, loadHistory]);

  // 广场「recreate」跳转预填：挂载时若带 initialPrompt 则应用一次（不随后续 props 变化重复触发）。
  useEffect(() => {
    if (!initialPrompt) return;
    setAppliedTemplate({
      id: `recreate-init-${Date.now()}`,
      title: initialPrompt.slice(0, 40),
      prompt: initialPrompt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 广场作品「使用提示词」：把该作品的 prompt 填进输入框（详情弹窗与卡片共用）。 */
  const useGalleryPrompt = (item: GalleryFeedItem) => {
    const prompt = item.post.prompt ?? item.post.description ?? '';
    if (!prompt) return;
    setAppliedTemplate({
      id: `${item.post.id}:${Date.now()}`,
      title: prompt.slice(0, 40),
      prompt,
    });
  };

  /** 广场作品「参考图」：把作品的图带进输入框当参考图（图已在对象存储上，无需再上传）。 */
  const useGalleryAsReference = (item: GalleryFeedItem) => {
    const url = item.post.coverImage ?? item.post.mediaUrls[0];
    if (!url) return;
    setAppliedReference({
      id: `gallery-ref-${item.post.id}:${Date.now()}`,
      url,
      name: `reference-${item.post.id}.png`,
    });
  };

  /** 卡片上的「引用」按钮：同上，卡片给的是映射件，转回原始 feed item。 */
  const useTemplateAsReference = (template: ImageTemplate) => {
    const item = galleryFeed[template.id];
    if (item) useGalleryAsReference(item);
  };

  /** 瀑布流卡片上的「使用」按钮走的是映射后的卡片形状，转回原始 feed item 后同上。 */
  const useTemplatePrompt = (template: ImageTemplate) => {
    const item = galleryFeed[template.id];
    if (item) {
      useGalleryPrompt(item);
      return;
    }
    // feed 里找不到（理论上不会发生）——退回卡片自带的 prompt，不让按钮变哑巴
    const prompt = resolveTemplatePrompt(template) || template.prompt;
    setAppliedTemplate({ id: `${template.id}:${Date.now()}`, title: template.title, prompt });
  };

  /**
   * 历史图片 Recreate：把该次生成的**模型 + prompt + 参考图**带回输入框，不回填参数、
   * 也不自动提交——参数留给用户自己选，生成由用户点击触发。
   */
  const handleRecreate = (item: PublicImageHistoryItem) => {
    if (item.modelConfigId && item.modelConfigId !== selectedModelId) {
      onModelChange(item.modelConfigId);
    }
    setAppliedRecreate({
      id: `recreate-${item.id}:${Date.now()}`,
      prompt: item.prompt,
      referenceImages: item.referenceImages ?? [],
    });
  };

  // 历史图片 Reference：把该图作为参考图塞回输入框（图已在对象存储上，无需再上传）
  const handleUseAsReference = (image: PublicImageHistoryImage) => {
    setAppliedReference({
      id: `history-ref-${image.generationId ?? ''}-${image.index}:${Date.now()}`,
      url: image.url,
      name: `reference-${image.index + 1}.png`,
    });
  };

  const handleGenerate = async (payload: PublicImageGenerationPayload) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/image' });
      return;
    }
    // 张数：1-4；ImageComposer 已 clamp 过，这里再兜底一次防脏参数被塞进请求。
    const requestedCount = Math.min(4, Math.max(1, Math.floor(Number(payload.count ?? 1))));
    // 为每一张预生成一个骨架占位卡（同一次请求内 id 不重复），后端全部并发落库后统一收敛。
    const pendingCards = Array.from({ length: requestedCount }, (_, idx) => ({
      id: `pending-image-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: payload.prompt,
      model: selectedModel?.name ?? payload.model,
      count: imageCapability.defaults.count,
      settings: payload.settings,
    }));
    setPendingGenerations((prev) => [...pendingCards, ...prev]);
    changeMode('history');
    setBillingGateContext({ featureName: selectedModel?.name ?? payload.model });
    try {
      const data = await publicGeneratorActions.generateImage({
        model: payload.model,
        prompt: payload.prompt,
        referenceImages: payload.referenceImages.map((url, index) => ({ url, index })),
        settings: payload.settings,
        visibility: payload.visibility,
        count: requestedCount,
      });
      // 按 generationId 拆成 N 条，与历史接口 / 删除 / 投稿的 1:1 口径一致。
      const nextHistoryItems = buildPublicImageHistoryItems({
        data,
        request: payload,
        createdAt: new Date().toISOString(),
        modelConfigId: selectedModelId,
      });
      setHistoryItems((prev) => [...nextHistoryItems, ...prev]);
    } catch (err) {
      // 并发超限：后端把 code 塞在 response.data.code；SDK 会把 code 透传到 Error。
      // spec §4/5 明确要求「弹 modal 提示超过当前会员等级的并发数量」——不能只 toast。
      const errCode = extractErrorCode(err);
      if (errCode === 'IMAGE_CONCURRENCY_LIMIT_EXCEEDED') {
        const details = extractConcurrencyDetails(err);
        setConcurrencyModal({
          limit: details.concurrency,
          active: details.activeCount,
          requested: details.requestedCount || requestedCount,
        });
      } else {
        toast.error(err instanceof Error ? err.message : t('generateFailed'));
      }
    } finally {
      // 用一次请求的 pendingIds 做集合过滤，避免把用户在此期间发起的其他生成骨架也一起清掉。
      const pendingIds = new Set(pendingCards.map((c) => c.id));
      setPendingGenerations((prev) => prev.filter((card) => !pendingIds.has(card.id)));
    }
  };

  /**
   * 点赞/收藏请求的「过期请求」防护：每次发起请求前给该 postId 的对应动作种类打一个
   * 递增版本号，请求 settle（无论成功/失败）时只有版本号仍是发起时那一个才应用结果，
   * 否则说明用户在这期间又点了一次（甚至好几次），这次 settle 已经过期，直接丢弃 ——
   * 不然纯靠「最后 settle 的赢」，一个姗姗来迟的失败回调可能把后来请求已经校准好的
   * 状态（服务端真实 likeCount 等）静默覆盖回旧值。
   * 用 useRef 存放，避免被重渲染重置；用 like/favorite 两个独立 keyspace，
   * 避免点赞请求在途时收藏动作把它的版本号也顶掉（反之亦然）。
   */
  const interactionVersionsRef = useRef<{ like: Record<string, number>; favorite: Record<string, number> }>({
    like: {},
    favorite: {},
  });
  const bumpInteractionVersion = (kind: 'like' | 'favorite', postId: string) => {
    const next = (interactionVersionsRef.current[kind][postId] ?? 0) + 1;
    interactionVersionsRef.current[kind][postId] = next;
    return next;
  };
  const isStaleInteractionVersion = (kind: 'like' | 'favorite', postId: string, version: number) =>
    interactionVersionsRef.current[kind][postId] !== version;

  /**
   * 点赞：乐观翻转 + ±1，失败回滚。成功后用服务端返回的 ResourceMetrics.likeCount 覆盖
   * 本地推算值 —— 多标签页并发点同一张也不会飘。
   * 未登录（feed 匿名时不返回 liked）→ 走站内既有的登录弹层，不另造一套。
   */
  const handleToggleLike = (postId: string) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/image' });
      return;
    }
    const current = interactions[postId];
    if (!current) return;
    const action = resolveLikeAction(current.liked);
    const optimistic: GalleryCardInteraction = {
      ...current,
      liked: action === 'like',
      likeCount: Math.max(0, current.likeCount + (action === 'like' ? 1 : -1)),
    };
    setInteractions((prev) => ({ ...prev, [postId]: optimistic }));

    const version = bumpInteractionVersion('like', postId);
    const request = action === 'like' ? galleryActions.like(postId) : galleryActions.unlike(postId);
    void request
      .then((metrics) => {
        if (isStaleInteractionVersion('like', postId, version)) return;
        setInteractions((prev) => ({
          ...prev,
          [postId]: { ...prev[postId]!, likeCount: metrics.likeCount },
        }));
      })
      .catch(() => {
        if (isStaleInteractionVersion('like', postId, version)) return;
        setInteractions((prev) => {
          const entry = prev[postId];
          if (!entry) return prev;
          return { ...prev, [postId]: { ...entry, liked: current.liked, likeCount: current.likeCount } };
        });
      });
  };

  /**
   * 收藏：POST/DELETE 是幂等的，不是 toggle —— 必须按当前 favorited 定方向（resolveFavoriteAction）。
   * 只维护状态、不显示计数：接口只返回 { favorited }，没有 favoriteCount 可用来校准乐观更新，
   * 显示一个校不准的数字不如不显示。
   */
  const handleToggleFavorite = (postId: string) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/image' });
      return;
    }
    const current = interactions[postId];
    if (!current) return;
    const action = resolveFavoriteAction(current.favorited);
    setInteractions((prev) => ({
      ...prev,
      [postId]: { ...prev[postId]!, favorited: action === 'favorite' },
    }));

    const version = bumpInteractionVersion('favorite', postId);
    const request =
      action === 'favorite' ? galleryActions.favorite(postId) : galleryActions.unfavorite(postId);
    void request
      .then((result) => {
        if (isStaleInteractionVersion('favorite', postId, version)) return;
        setInteractions((prev) => ({
          ...prev,
          [postId]: { ...prev[postId]!, favorited: result.favorited },
        }));
      })
      .catch(() => {
        if (isStaleInteractionVersion('favorite', postId, version)) return;
        setInteractions((prev) => {
          const entry = prev[postId];
          if (!entry) return prev;
          return { ...prev, [postId]: { ...entry, favorited: current.favorited } };
        });
      });
  };

  return (
    <div className="relative h-full">
      {/* 背景由 PublicGeneratorStudioView 的全屏固定底层统一提供，此处不再自带背景，避免滑动时错位漏底 */}
      <main className="relative h-full overflow-hidden">
      {galleryMode ? (
        <PublicImageTemplateWall
          templates={templates}
          loading={templatesLoading}
          loadingMore={templatesLoadingMore}
          hasMore={Boolean(templatesCursor)}
          onLoadMore={loadMoreTemplates}
          animatedCount={GALLERY_PAGE_SIZE}
          aspectRatios={templateAspects}
          density={templateDensity}
          onSelectTemplate={openGalleryPost}
          onUseTemplate={useTemplatePrompt}
          interactions={interactions}
          onToggleLike={handleToggleLike}
          onUseAsReference={useTemplateAsReference}
        />
      ) : null}
      {galleryMode ? <div className="growth-template-scroll-overlay pointer-events-none absolute inset-0" /> : null}

      {!galleryMode ? (
        mode === 'history' && (historyItems.length > 0 || pendingGenerations.length > 0) ? (
          // 历史画廊：全屏铺满、横向 justified 行布局（固定行高，滑块调行高）
          <div className="relative z-10 h-full overflow-y-auto overscroll-contain px-[3px] pb-36 pt-14">
            <PublicImageHistoryPanel
              items={historyItems}
              loading={historyLoading}
              density={templateDensity}
              pendingGenerations={pendingGenerations}
              onRecreate={handleRecreate}
              onUseAsReference={handleUseAsReference}
              onSelectionActiveChange={setHistorySelectionActive}
              onHistoryChanged={() => void loadHistory()}
            />
          </div>
        ) : (
          // 空态：居中引导
          <div className="relative z-10 h-full overflow-y-auto overscroll-contain">
            <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-3 px-4 pb-36 pt-14 md:px-6">
              <section className="flex min-h-[calc(100svh-374px)] flex-col items-center justify-center pb-12 pt-2 text-center">
                <h1 className="text-4xl font-black uppercase leading-[0.96] tracking-normal text-foreground md:text-5xl">
                  {t('imageBlankTitle')}
                  <span className="block text-growth-accent">{t('imageBlankAccent', { model: selectedModel?.name ?? imageCapability.displayName })}</span>
                </h1>
                <p className="mt-4 max-w-xl text-base font-medium text-foreground/42">
                  {t('imageBlankDescription')}
                </p>
              </section>
            </div>
          </div>
        )
      ) : null}

      <div
        className={`pointer-events-none fixed inset-x-0 bottom-[30px] z-40 transition-all duration-300 ${historySelectionActive ? 'translate-y-8 opacity-0 [&_*]:!pointer-events-none' : 'translate-y-0 opacity-100'}`}
      >
        <ImageComposer
          communityMode={galleryMode}
          imageModels={imageModels}
          selectedModel={selectedModel}
          selectedModelId={selectedModelId}
          selectedModelValue={selectedModelValue}
          modelsLoading={modelsLoading}
          paramsSchema={paramsSchema}
          pricingSchema={pricingSchema}
          pricingContext={pricingContext}
          appliedTemplate={appliedTemplate}
          appliedReference={appliedReference}
          appliedRecreate={appliedRecreate}
          onGenerate={handleGenerate}
          onModelChange={onModelChange}
        />
      </div>

      {/* 广场作品详情：本地弹窗（数据来自 feed，瞬开），地址栏由 useGalleryPostModal 改成
          /gallery/<id>——刷新才走那条真实路由的完整页 */}
      <GalleryDetailDialog
        item={galleryModal.item}
        onClose={galleryModal.close}
        interaction={galleryModal.item ? interactions[galleryModal.item.post.id] : undefined}
        onToggleLike={handleToggleLike}
        onToggleFavorite={handleToggleFavorite}
        onRecreate={(item) => {
          useGalleryPrompt(item);
          galleryModal.close();
        }}
        onUseAsReference={(item) => {
          useGalleryAsReference(item);
          galleryModal.close();
        }}
      />
      </main>

      {/* 顶部悬浮控件：绝对定位、不占内容流（图片直接顶到导航下方），
          左右两个控件浮在内容之上；整层不拦截点击，仅控件本身可交互 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="pointer-events-auto">
          <ModeTabs active={mode} onChange={changeMode} />
        </div>
        <div className="pointer-events-auto">
          <StudioDensitySlider
            label={t('density')}
            value={templateDensity}
            onChange={setTemplateDensity}
          />
        </div>
      </div>

      {/* 并发超限弹窗：单次生成张数 + 在途张数 > 会员等级 concurrency 时，服务端拒绝，
          这里根据 error.data 里的 concurrency/activeCount/requestedCount 提示用户。 */}
      <Dialog
        open={concurrencyModal !== null}
        onOpenChange={(open) => {
          if (!open) setConcurrencyModal(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('concurrencyLimitTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-foreground/80">
              {t('concurrencyLimitDescription', {
                limit: concurrencyModal?.limit ?? 0,
                active: concurrencyModal?.active ?? 0,
                requested: concurrencyModal?.requested ?? 0,
              })}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConcurrencyModal(null)}>
              {t('concurrencyLimitOk')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
