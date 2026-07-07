'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ImageModelCapability } from '@autix/domain/image';
import {
  publicGeneratorActions,
  useAuthStore,
  useUiStore,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import { resolveTemplatePrompt } from '../../../image/studio/constants';
import type { PublicGrowthMediaItem } from '../../types';
import { ModeTabs, StudioDensitySlider } from '../parts';
import type { ImageStudioMode, TemplateDensity } from '../generator-studio-helpers';
import { ImageComposer } from './ImageComposer';
import { ImageHeroCollage, PublicImageTemplateWall } from './ImageTemplateWall';
import { PublicImageHistoryPanel, type PendingImageGenerationCard } from './PublicImageHistoryPanel';
import { PublicImageTemplateDialog } from './ImageTemplateDialog';
import {
  buildPublicImageHistoryItem,
  type PublicImageGenerationPayload,
  type PublicImageHistoryItem,
} from './public-image-generation';

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
    publicGeneratorActions
      .listImageTemplates({ sort: 'popular', pageSize: 60 })
      .then((items) => {
        if (!cancelled) setTemplates(items);
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

  const useTemplatePrompt = (template: ImageTemplate) => {
    const prompt = resolveTemplatePrompt(template) || template.prompt;
    setAppliedTemplate({
      id: `${template.id}:${Date.now()}`,
      title: template.title,
      prompt,
    });
    setSelectedTemplate(null);
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
    <main className="relative min-h-[calc(100svh-104px)] overflow-hidden bg-background">
      <div className="growth-image-studio-bg absolute inset-0" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.13]" />
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

      <div className="relative z-10 mx-auto flex w-full max-w-[1720px] flex-col gap-3 px-4 pt-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <ModeTabs active={mode} onChange={setMode} />
          <StudioDensitySlider
            label={t('density')}
            value={templateDensity}
            onChange={setTemplateDensity}
          />
        </div>

        {!templateMode ? (
          mode === 'history' && (historyItems.length > 0 || pendingGeneration) ? (
            <section className="pb-36 text-left">
              <PublicImageHistoryPanel
                items={historyItems}
                loading={historyLoading}
                density={templateDensity}
                pending={pendingGeneration}
              />
            </section>
          ) : (
            <section className="flex min-h-[calc(100svh-374px)] flex-col items-center justify-center pb-12 pt-2 text-center">
              <ImageHeroCollage items={items} />
              <h1 className="text-4xl font-black uppercase leading-[0.96] tracking-normal text-foreground md:text-5xl">
                {t('imageBlankTitle')}
                <span className="block text-growth-accent">{t('imageBlankAccent', { model: selectedModel?.name ?? imageCapability.displayName })}</span>
              </h1>
              <p className="mt-4 max-w-xl text-base font-medium text-foreground/42">
                {t('imageBlankDescription')}
              </p>
              {mode === 'history' ? (
                <div className="mt-8 w-full max-w-2xl">
                  <PublicImageHistoryPanel
                    items={historyItems}
                    loading={historyLoading}
                    density={templateDensity}
                    pending={pendingGeneration}
                  />
                </div>
              ) : null}
            </section>
          )
        ) : null}
      </div>

      {templateMode ? (
        <section className="pointer-events-none relative z-10 min-h-[calc(100svh-320px)]" aria-label={t('templateMode')} />
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-[30px] z-40">
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
  );
}
