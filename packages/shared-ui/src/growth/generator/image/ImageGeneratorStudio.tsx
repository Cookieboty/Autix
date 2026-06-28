'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ImageModelCapability } from '@autix/domain/image';
import {
  imageWorkbenchActions,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import { resolveTemplatePrompt } from '../../../image/studio/constants';
import type { PublicGrowthMediaItem } from '../../types';
import { ModeTabs, StudioDensitySlider } from '../parts';
import type { ImageStudioMode, TemplateDensity } from '../generator-studio-helpers';
import { ImageComposer } from './ImageComposer';
import { ImageHeroCollage, PublicImageTemplateWall } from './ImageTemplateWall';
import { PublicImageTemplateDialog } from './ImageTemplateDialog';

export function ImageGeneratorStudio({
  items,
  imageCapability,
  imageModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  onModelChange,
}: {
  items: PublicGrowthMediaItem[];
  imageCapability: ImageModelCapability;
  imageModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [mode, setMode] = useState<ImageStudioMode>('history');
  const templateMode = mode === 'templates';
  const [templateDensity, setTemplateDensity] = useState<TemplateDensity>('normal');
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ImageTemplate | null>(null);
  const [appliedTemplate, setAppliedTemplate] = useState<{
    id: string;
    title: string;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    imageWorkbenchActions
      .listTemplates({ sort: 'popular', pageSize: 60 })
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

  const useTemplatePrompt = (template: ImageTemplate) => {
    const prompt = resolveTemplatePrompt(template) || template.prompt;
    setAppliedTemplate({
      id: `${template.id}:${Date.now()}`,
      title: template.title,
      prompt,
    });
    setSelectedTemplate(null);
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

      <div className="relative z-10 flex items-start justify-between gap-3 px-1 pt-3 md:px-2">
        <ModeTabs active={mode} onChange={setMode} />
        {templateMode ? (
          <StudioDensitySlider
            label={t('density')}
            value={templateDensity}
            onChange={setTemplateDensity}
          />
        ) : null}
      </div>

      {!templateMode ? (
        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-374px)] max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-12 text-center">
          <ImageHeroCollage items={items} />
          <h1 className="text-4xl font-black uppercase leading-[0.96] tracking-normal text-foreground md:text-5xl">
            {t('imageBlankTitle')}
            <span className="block text-growth-accent">{t('imageBlankAccent', { model: selectedModel?.name ?? imageCapability.displayName })}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium text-foreground/42">
            {t('imageBlankDescription')}
          </p>
        </section>
      ) : (
        <section className="pointer-events-none relative z-10 min-h-[calc(100svh-320px)]" aria-label={t('templateMode')} />
      )}

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
