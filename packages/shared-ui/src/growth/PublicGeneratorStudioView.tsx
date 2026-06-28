'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelCapability,
} from '@autix/domain/image';
import {
  hasImageCapability,
  isVideoModel,
  listPublicAvailableModels,
  type ModelConfigItem,
} from '@autix/shared-store';
import { getFallbackItems } from './fallback';
import {
  findImageModelByHint,
  resolveImageCapabilityFromModelParam,
} from './generator-image-presenters';
import { buildGeneratorWorkbenchHref } from './generator-workbench-href';
import {
  DEFAULT_PUBLIC_VIDEO_MODEL,
  findVideoModelByHint,
} from './generator-video-presenters';
import { PublicGeneratorAppNav } from './PublicGeneratorAppNav';
import { PublicPromoBar } from './PublicPromoBar';
import type { PublicGrowthMediaItem } from './types';
import { ImageGeneratorStudio } from './generator/image/ImageGeneratorStudio';
import { VideoGeneratorStudio } from './generator/video/VideoGeneratorStudio';

type GeneratorKind = 'image' | 'video';

function getImageCapabilityForModel(model: ModelConfigItem | null, fallback: ImageModelCapability) {
  if (!model) return fallback;
  return IMAGE_MODEL_CAPABILITIES[detectImageModelKind(model)];
}

export function PublicGeneratorStudioView({
  kind,
  examples,
  initialModel,
}: {
  kind: GeneratorKind;
  examples?: PublicGrowthMediaItem[] | null;
  initialModel?: string | null;
}) {
  const t = useTranslations('publicGrowth');
  const items = useMemo(
    () => (examples?.length ? examples : getFallbackItems(t)).filter((item) => item.mediaUrl),
    [examples, t],
  );
  const fallbackImageCapability = useMemo(
    () => resolveImageCapabilityFromModelParam(initialModel),
    [initialModel],
  );
  const [imageModels, setImageModels] = useState<ModelConfigItem[]>([]);
  const [selectedImageModelId, setSelectedImageModelId] = useState<string | null>(null);
  const [imageModelsLoading, setImageModelsLoading] = useState(kind === 'image');
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [selectedVideoModelId, setSelectedVideoModelId] = useState<string | null>(null);
  const [videoModelsLoading, setVideoModelsLoading] = useState(kind === 'video');
  const selectedImageModel = imageModels.find((model) => model.id === selectedImageModelId) ?? null;
  const selectedVideoModel = videoModels.find((model) => model.id === selectedVideoModelId) ?? null;
  const imageCapability = useMemo(
    () => getImageCapabilityForModel(selectedImageModel, fallbackImageCapability),
    [fallbackImageCapability, selectedImageModel],
  );
  const selectedImageModelValue = selectedImageModel?.id ?? initialModel ?? null;
  const selectedVideoModelValue = selectedVideoModel?.id ?? initialModel ?? null;
  const workbenchHref = buildGeneratorWorkbenchHref({
    kind: 'video',
    model: selectedVideoModelValue ?? DEFAULT_PUBLIC_VIDEO_MODEL,
  });

  useEffect(() => {
    if (kind !== 'image') {
      setImageModelsLoading(false);
      return;
    }

    let cancelled = false;
    setImageModelsLoading(true);
    listPublicAvailableModels()
      .then((models) => {
        if (cancelled) return;
        const candidates = models.filter((model) => hasImageCapability(model.capabilities ?? []));
        setImageModels(candidates);
        const preferred =
          findImageModelByHint(candidates, initialModel) ??
          candidates.find((model) => model.isDefault) ??
          candidates[0] ??
          null;
        setSelectedImageModelId((current) =>
          current && candidates.some((model) => model.id === current)
            ? current
            : preferred?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setImageModels([]);
          setSelectedImageModelId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setImageModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialModel, kind]);

  useEffect(() => {
    if (kind !== 'video') {
      setVideoModelsLoading(false);
      return;
    }

    let cancelled = false;
    setVideoModelsLoading(true);
    listPublicAvailableModels()
      .then((models) => {
        if (cancelled) return;
        const candidates = models.filter(isVideoModel);
        setVideoModels(candidates);
        const preferred =
          findVideoModelByHint(candidates, initialModel) ??
          candidates.find((model) => model.isDefault) ??
          candidates[0] ??
          null;
        setSelectedVideoModelId((current) =>
          current && candidates.some((model) => model.id === current)
            ? current
            : preferred?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setVideoModels([]);
          setSelectedVideoModelId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setVideoModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialModel, kind]);

  return (
    <div className="min-h-svh bg-card pt-[104px] text-foreground">
      <div className="fixed inset-x-0 top-0 z-50">
        <PublicPromoBar label={t('generator.studio.topPromo')} href="/pricing" />
        <PublicGeneratorAppNav kind={kind} />
      </div>
      {kind === 'video' ? (
        <VideoGeneratorStudio
          items={items}
          workbenchHref={workbenchHref}
          initialModel={initialModel}
          videoModels={videoModels}
          selectedModel={selectedVideoModel}
          selectedModelId={selectedVideoModelId}
          selectedModelValue={selectedVideoModelValue}
          modelsLoading={videoModelsLoading}
          onModelChange={setSelectedVideoModelId}
        />
      ) : (
        <ImageGeneratorStudio
          items={items}
          imageCapability={imageCapability}
          imageModels={imageModels}
          selectedModel={selectedImageModel}
          selectedModelId={selectedImageModelId}
          selectedModelValue={selectedImageModelValue}
          modelsLoading={imageModelsLoading}
          onModelChange={setSelectedImageModelId}
        />
      )}
    </div>
  );
}
