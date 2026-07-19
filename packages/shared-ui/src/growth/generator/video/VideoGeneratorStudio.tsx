'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  hasChatCapability,
  isVideoModel,
  listAvailableModels,
  publicGeneratorActions,
  setBillingGateContext,
  useAuthStore,
  useUiStore,
  type DirectVideoGenerationDto,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import { VideoSidebar } from './VideoSidebar';
import { VideoHowItWorks } from './VideoHowItWorks';
import type { PublicVideoGenerationPayload } from './public-video-generation';
import type { PendingVideoGenerationCard } from './VideoHistoryPanel';
import { usePathname, useRouter, useSearchParams } from '../../../navigation';

/** 轮询终态：completed/failed/expired 都收敛为「结束」，非 completed 的按失败处理。 */
const TERMINAL_VIDEO_STATUSES = new Set(['completed', 'failed', 'expired']);
/** 直连生成的"进行中"三态；与 VideoHistoryPanel 的 PROCESSING_STATUSES 保持一致。 */
const PROCESSING_VIDEO_STATUSES = new Set(['pending', 'queued', 'running']);
/** 固定间隔轮询上限保护：3s * 120 = 6 分钟，对齐视频生成的常见耗时上界。 */
const VIDEO_POLL_MAX_ATTEMPTS = 120;
const VIDEO_POLL_INTERVAL_MS = 3000;

export function VideoGeneratorStudio({
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  paramsSchema,
  pricingSchema,
  pricingContext,
  onModelChange,
}: {
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  // tab 存进 URL，刷新/分享都能保持；默认 history。
  // 用 replace 而非 push：切 tab 不该在浏览器历史里堆一堆条目，返回键应回到上一个页面。
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tab: 'history' | 'gallery' = searchParams.get('tab') === 'gallery' ? 'gallery' : 'history';
  const setTab = useCallback(
    (next: 'history' | 'gallery') => {
      const params = new URLSearchParams(searchParams.toString());
      // history 是默认值，不写进 URL，保持地址干净
      if (next === 'gallery') params.set('tab', 'gallery');
      else params.delete('tab');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );
  // 素材面板的挂载宿主（右栏容器）。用 state 而非 ref：ref 变化不触发重渲染，
  // portal 目标拿不到就永远渲染不出来。
  const [assetPanelHost, setAssetPanelHost] = useState<HTMLDivElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<PendingVideoGenerationCard | null>(null);
  const [textModels, setTextModels] = useState<ModelConfigItem[]>([]);
  const [textModelsLoading, setTextModelsLoading] = useState(true);
  const [selectedTextModelId, setSelectedTextModelId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  // 直连视频生成的扁平历史（不再走 video-project store 的多镜头项目模型）。
  const [historyItems, setHistoryItems] = useState<DirectVideoGenerationDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);

  // 记录当前正在被轮询的历史项 id，避免同一条记录被并发轮询多次。
  // 用 ref 承载以便在 effect / 回调之间共享，不参与渲染。
  const pollingIdsRef = useRef<Set<string>>(new Set());
  // 组件卸载标记：轮询 while 循环里用来提前退出，避免卸载后仍触发 setState。
  const unmountedRef = useRef(false);
  useEffect(() => {
    // 挂载时必须复位：React 18 dev 的 StrictMode 会 mount→unmount→remount，
    // 只在 cleanup 里置 true 的话第二次挂载后它永远是 true，轮询循环第一次判断
    // 就 return —— 开发环境下刷新页面后进行中的任务永远不会转成 completed，
    // 很容易被误判成后端问题。
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const reloadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setHistoryItems([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      setHistoryItems(await publicGeneratorActions.listVideoHistory({ page: 1, pageSize: 30 }));
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  // 对刷新后仍处于 pending/queued/running 的历史记录启动独立轮询：
  // 页面刷新时若有正在生成的任务，用户能立刻看到"进行中"卡片，并等待其自动转为 completed/failed。
  // 每条记录只会有一个在飞的轮询循环（pollingIdsRef 去重），命中终态或达到上限后自动退出。
  useEffect(() => {
    if (!isAuthenticated) return;
    const pendingIds = historyItems
      .filter((item) => PROCESSING_VIDEO_STATUSES.has(item.status))
      .map((item) => item.id)
      .filter((id) => !pollingIdsRef.current.has(id));
    if (pendingIds.length === 0) return;

    for (const id of pendingIds) {
      pollingIdsRef.current.add(id);
      void (async () => {
        try {
          for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
            if (unmountedRef.current) return;
            await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
            if (unmountedRef.current) return;
            let latest: DirectVideoGenerationDto;
            try {
              latest = await publicGeneratorActions.getVideoGeneration(id);
            } catch {
              // 网络/鉴权抖动时继续等待，不打断循环；达到上限后自然退出。
              continue;
            }
            if (unmountedRef.current) return;
            // 就地替换该项，保持列表顺序与其他项不动。
            setHistoryItems((prev) =>
              prev.some((item) => item.id === id)
                ? prev.map((item) => (item.id === id ? latest : item))
                : prev,
            );
            if (TERMINAL_VIDEO_STATUSES.has(latest.status)) return;
          }
        } finally {
          pollingIdsRef.current.delete(id);
        }
      })();
    }
  }, [historyItems, isAuthenticated]);

  /**
   * 历史「Recreate」：把该次生成的提示词推回侧边栏输入框，并切到 history 之外无需动作
   * （用户就在这个页面上，直接改了输入框即可）。token 递增让连点两次也能生效。
   */
  const [injectedPrompt, setInjectedPrompt] = useState<{ text: string; token: number } | undefined>();
  const handleRecreate = (item: DirectVideoGenerationDto) => {
    setInjectedPrompt((prev) => ({ text: item.prompt, token: (prev?.token ?? 0) + 1 }));
  };

  useEffect(() => {
    // 优化模型列表用登录后的通用/对话模型（公开模型接口通常不含 chat 模型）；
    // 优化本身也需登录，未登录时不拉取，登录后再加载。
    if (!isAuthenticated) {
      setTextModels([]);
      setTextModelsLoading(false);
      return;
    }
    let cancelled = false;
    setTextModelsLoading(true);
    listAvailableModels()
      .then((models) => {
        if (cancelled) return;
        const candidates = models.filter(
          (item) => hasChatCapability(item.capabilities ?? []) && !isVideoModel(item),
        );
        setTextModels(candidates);
        setSelectedTextModelId((current) =>
          current && candidates.some((item) => item.id === current)
            ? current
            : candidates.find((item) => item.isDefault)?.id ?? candidates[0]?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setTextModels([]);
      })
      .finally(() => {
        if (!cancelled) setTextModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleOptimizePrompt = async (prompt: string): Promise<string | null> => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/video' });
      return null;
    }
    setOptimizing(true);
    try {
      return await publicGeneratorActions.optimizeVideoPrompt({
        prompt,
        modelId: selectedTextModelId ?? undefined,
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleGenerate = async (payload: PublicVideoGenerationPayload) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/video' });
      return;
    }
    setPendingGeneration({
      id: `pending-video-${Date.now()}`,
      title: payload.title,
      prompt: payload.prompt,
      model: String(payload.params.model ?? selectedModel?.name ?? selectedModelValue ?? ''),
      coverUrl: payload.materials[0]?.url ?? null,
    });
    setTab('history');
    setGenerating(true);
    // 同上：让拦截弹框能显示「解锁 XXX」
    setBillingGateContext({
      featureName: selectedModel?.name ?? String(payload.params.model ?? selectedModelValue ?? ''),
    });
    try {
      const { generationId } = await publicGeneratorActions.generateVideoDirect({
        prompt: payload.prompt,
        params: payload.params,
        materials: payload.materials.map((material) => ({
          role: 'reference_image',
          url: material.url,
          sourceType: material.sourceType ?? 'upload',
          name: material.name ?? undefined,
        })),
      });
      // 简单固定间隔轮询到终态（对齐图片工作台的同步等待体验；上限保护见常量）。
      for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
        const generation = await publicGeneratorActions.getVideoGeneration(generationId);
        if (TERMINAL_VIDEO_STATUSES.has(generation.status)) {
          if (generation.status !== 'completed') {
            throw new Error(generation.error ?? t('generateFailed'));
          }
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
      }
      await reloadHistory();
    } finally {
      setGenerating(false);
      setPendingGeneration(null);
    }
  };

  // lg 起吃满滚动容器高度：右栏据此做「自身滚动 + 顶栏悬浮」，外层滚动条不再出现
  return (
    <div className="relative min-h-[calc(100svh-104px)] lg:h-full lg:min-h-0">
      {/* 背景由 PublicGeneratorStudioView 的全屏固定底层统一提供，此处不再自带背景，避免滑动时错位漏底 */}
      {/* 与导航核心内容同宽：max-w-[1920px] + px-3/md:px-5。
          只留上内边距：右栏内容卡片要一直贴到视口底部，有下内边距就会露出一条缝。 */}
      <div className="relative z-10 mx-auto flex max-w-[1920px] flex-col gap-4 px-3 pb-3 pt-3 md:px-5 lg:h-full lg:pb-0 lg:flex-row">
        {/* 编辑区在左、引导/历史区在右；移动端编辑区在上（同 DOM 顺序） */}
        <div className="lg:w-[320px] lg:shrink-0">
          <VideoSidebar
            assetPanelHost={assetPanelHost}
            initialModel={initialModel}
            videoModels={videoModels}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            selectedModelValue={selectedModelValue}
            modelsLoading={modelsLoading}
            paramsSchema={paramsSchema}
            pricingSchema={pricingSchema}
            pricingContext={pricingContext}
            generating={generating}
            onGenerate={handleGenerate}
            onModelChange={onModelChange}
            textModels={textModels}
            textModelsLoading={textModelsLoading}
            selectedTextModelId={selectedTextModelId}
            onTextModelChange={setSelectedTextModelId}
            optimizing={optimizing}
            onOptimizePrompt={handleOptimizePrompt}
            injectedPrompt={injectedPrompt}
          />
        </div>
        {/* 右栏包一层定位容器：素材面板 portal 到这里，正好覆盖右侧内容区 */}
        <div ref={setAssetPanelHost} className="relative min-w-0 flex-1 lg:h-full">
        <VideoHowItWorks
          activeTab={tab}
          pendingGeneration={pendingGeneration}
          onTabChange={setTab}
          historyItems={historyItems}
          historyLoading={historyLoading}
          onRecreate={handleRecreate}
          onHistoryChanged={() => void reloadHistory()}
        />
        </div>
      </div>
    </div>
  );
}
