'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ImageModelCapability } from '@autix/domain/image';
import {
  publicGalleryActions,
  publicGeneratorActions,
  useAuthStore,
  useUiStore,
  type GalleryFeedItem,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import { resolveTemplatePrompt } from '../../../image/studio/constants';
import type { PublicGrowthMediaItem } from '../../types';
import { ModeTabs, StudioDensitySlider } from '../parts';
import type { ImageStudioMode, TemplateDensity } from '../generator-studio-helpers';
import { ImageComposer } from './ImageComposer';
import { PublicImageTemplateWall } from './ImageTemplateWall';
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
 */
function galleryItemToTemplateCard(item: GalleryFeedItem): ImageTemplate {
  const { post, metrics } = item;
  const cover = post.coverImage ?? post.mediaUrls[0] ?? '';
  return {
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
  } as unknown as ImageTemplate;
}

export function ImageGeneratorStudio({
  items,
  imageCapability,
  imageModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
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
        if (!cancelled) setTemplates(feed.map(galleryItemToTemplateCard));
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
    if (!isAuthenticated) {
      setHistoryItems([]);
      setHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setHistoryLoading(true);
    publicGeneratorActions
      .listImageHistory({ pageSize: 30 })
      .then((items) => {
        if (!cancelled) {
          setHistoryItems(
            items.map((item) => ({
              id: item.id,
              prompt: item.resolvedPrompt,
              model: item.modelUsed,
              createdAt: item.createdAt,
              settings: {
                size: String(item.settings?.size ?? ''),
                quality: item.settings?.quality ? String(item.settings.quality) : undefined,
                count: item.images.length || item.generatedImages.length || 1,
                guidanceScale: 7,
                steps: 30,
                promptTuning: 'auto',
                stylePreset: 'general',
                skipPromptTuning: true,
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
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryItems([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

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
      count: payload.settings.count,
      size: payload.settings.size,
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
          imageCapability={imageCapability}
          imageModels={imageModels}
          selectedModel={selectedModel}
          selectedModelId={selectedModelId}
          selectedModelValue={selectedModelValue}
          modelsLoading={modelsLoading}
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
