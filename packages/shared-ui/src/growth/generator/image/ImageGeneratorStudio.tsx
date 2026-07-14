'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ImageModelCapability } from '@autix/domain/image';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import {
  galleryActions,
  publicGalleryActions,
  publicGeneratorActions,
  useAuthStore,
  useUiStore,
  type GalleryFeedItem,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import { resolveTemplatePrompt } from '../media-inputs';
import type { PublicGrowthMediaItem } from '../../types';
import { ModeTabs, StudioDensitySlider } from '../parts';
import type { ImageStudioMode, TemplateDensity } from '../generator-studio-helpers';
import { ImageComposer } from './ImageComposer';
import { resolveFavoriteAction, resolveLikeAction } from './gallery-interaction-model';
import { PublicImageTemplateWall, type GalleryCardInteraction } from './ImageTemplateWall';
import { PublicImageHistoryPanel, type PendingImageGenerationCard } from './PublicImageHistoryPanel';
import { PublicImageTemplateDialog } from './ImageTemplateDialog';
import {
  buildPublicImageHistoryItem,
  type PublicImageGenerationPayload,
  type PublicImageHistoryItem,
} from './public-image-generation';

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
    authorName: post.authorSnapshot?.displayName ?? '',
    authorUrl: post.authorSnapshot?.avatarUrl ?? '',
    category: post.category,
    likeCount: metrics.likeCount,
    viewCount: metrics.viewCount,
    useCount: 0,
    modelHint: post.model ?? '',
  };
  return card as ImageTemplate;
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
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [mode, setMode] = useState<ImageStudioMode>(initialMode);
  const templateMode = mode === 'templates';
  const [templateDensity, setTemplateDensity] = useState<TemplateDensity>('normal');
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [interactions, setInteractions] = useState<Record<string, GalleryCardInteraction>>({});
  const [historyItems, setHistoryItems] = useState<PublicImageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<PendingImageGenerationCard | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ImageTemplate | null>(null);
  const [historySelectionActive, setHistorySelectionActive] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const [appliedTemplate, setAppliedTemplate] = useState<{
    id: string;
    title: string;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    // 数据源改为广场（gallery_posts）已发布作品；沿用模板墙/详情弹窗的交互，
    // 把广场作品映射成模板卡片形状（description 充当 prompt）。
    publicGalleryActions
      .listFeed({ kind: 'IMAGE', limit: 60 })
      .then((feed) => {
        if (cancelled) return;
        setTemplates(feed.map(galleryItemToTemplateCard));
        setInteractions(
          Object.fromEntries(feed.map((item) => [item.post.id, galleryItemToInteraction(item)])),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTemplates([]);
          setInteractions({});
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          // settings 现在是透传 bag（spec §11 第 2 期）：历史回填只需要展示用的
          // size/quality，不再伪造 guidanceScale/steps/stylePreset 等已下线的
          // 固定字段——PublicImageHistoryItem.settings 的类型不再要求它们。
          settings: {
            size: String(item.settings?.size ?? ''),
            quality: item.settings?.quality ? String(item.settings.quality) : undefined,
          },
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

  const useTemplatePrompt = (template: ImageTemplate) => {
    const prompt = resolveTemplatePrompt(template) || template.prompt;
    setAppliedTemplate({
      id: `${template.id}:${Date.now()}`,
      title: template.title,
      prompt,
    });
    setSelectedTemplate(null);
  };

  // 历史图片 Recreate：把该次生成的 prompt 应用到输入框
  const handleRecreate = (item: PublicImageHistoryItem) => {
    if (!item.prompt) return;
    setAppliedTemplate({
      id: `history-${item.id}:${Date.now()}`,
      title: item.prompt.slice(0, 40),
      prompt: item.prompt,
    });
  };

  const handleGenerate = async (payload: PublicImageGenerationPayload) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/image' });
      return;
    }
    setPendingGeneration({
      id: `pending-image-${Date.now()}`,
      prompt: payload.prompt,
      model: selectedModel?.name ?? payload.model,
      // 生成张数已下线为用户可调项（业务逻辑固定吃掉），settings 里也不再携带
      // count（spec §11 第 2 期：透传 schema 参数，count 从不是 schema 属性）——
      // 骨架占位卡的张数改用 imageCapability 的模型默认值，目前所有能力表都是 1。
      count: imageCapability.defaults.count,
      size: typeof payload.settings.size === 'string' ? payload.settings.size : undefined,
    });
    setMode('history');
    setGenerating(true);
    try {
      const data = await publicGeneratorActions.generateImage({
        model: payload.model,
        prompt: payload.prompt,
        referenceImages: payload.referenceImages.map((url, index) => ({ url, index })),
        settings: payload.settings,
        visibility: payload.visibility,
      });
      const nextHistoryItem = buildPublicImageHistoryItem({
        data,
        request: payload,
        createdAt: new Date().toISOString(),
      });
      setHistoryItems((prev) => [nextHistoryItem, ...prev]);
    } finally {
      setGenerating(false);
      setPendingGeneration(null);
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
      {templateMode ? (
        <PublicImageTemplateWall
          templates={templates}
          loading={templatesLoading}
          density={templateDensity}
          onSelectTemplate={setSelectedTemplate}
          onUseTemplate={useTemplatePrompt}
          interactions={interactions}
          onToggleLike={handleToggleLike}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : null}
      {templateMode ? <div className="growth-template-scroll-overlay pointer-events-none absolute inset-0" /> : null}

      {!templateMode ? (
        mode === 'history' && (historyItems.length > 0 || pendingGeneration) ? (
          // 历史画廊：全屏铺满、横向 justified 行布局（固定行高，滑块调行高）
          <div className="relative z-10 h-full overflow-y-auto overscroll-contain px-[3px] pb-36 pt-14">
            <PublicImageHistoryPanel
              items={historyItems}
              loading={historyLoading}
              density={templateDensity}
              pending={pendingGeneration}
              onRecreate={handleRecreate}
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
          communityMode={templateMode}
          imageModels={imageModels}
          selectedModel={selectedModel}
          selectedModelId={selectedModelId}
          selectedModelValue={selectedModelValue}
          modelsLoading={modelsLoading}
          paramsSchema={paramsSchema}
          pricingSchema={pricingSchema}
          pricingContext={pricingContext}
          appliedTemplate={appliedTemplate}
          generating={generating}
          onGenerate={handleGenerate}
          onModelChange={onModelChange}
        />
      </div>
      <PublicImageTemplateDialog
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onUsePrompt={useTemplatePrompt}
        interactions={interactions}
        onToggleLike={handleToggleLike}
        onToggleFavorite={handleToggleFavorite}
      />
      </main>

      {/* 顶部悬浮控件：绝对定位、不占内容流（图片直接顶到导航下方），
          左右两个控件浮在内容之上；整层不拦截点击，仅控件本身可交互 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="pointer-events-auto">
          <ModeTabs active={mode} onChange={setMode} />
        </div>
        <div className="pointer-events-auto">
          <StudioDensitySlider
            label={t('density')}
            value={templateDensity}
            onChange={setTemplateDensity}
          />
        </div>
      </div>
    </div>
  );
}
