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
import { findVideoModelByHint } from './generator-video-presenters';
import { PublicPromoBar } from './PublicPromoBar';
import { buildDiscountTranslationValues } from './discount';
import type { ImageStudioMode } from './generator/generator-studio-helpers';
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
  initialMode,
}: {
  kind: GeneratorKind;
  examples?: PublicGrowthMediaItem[] | null;
  initialModel?: string | null;
  initialMode?: ImageStudioMode;
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
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* 功能页主题背景：唯一的全屏固定底层（渐变 + 噪点），滑动时不动，内容与导航都透出它 */}
      <div
        className={`pointer-events-none fixed inset-0 ${kind === 'video' ? 'growth-video-studio-bg' : 'growth-image-studio-bg'}`}
      />
      <div
        className={`growth-generator-noise pointer-events-none fixed inset-0 ${kind === 'video' ? 'opacity-[0.1]' : 'opacity-[0.13]'}`}
      />
      {/* 导航由 (public) layout 持久提供；此处仅保留功能页自己的促销条（在导航下方，固定不滚） */}
      <div className="relative shrink-0">
        <PublicPromoBar label={t('generator.studio.topPromo', buildDiscountTranslationValues())} href="/pricing" />
      </div>
      {/* studio 区占满剩余高度（定高）：image 内部自管滚动；video 在此容器内滚动 */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-none">
        {kind === 'video' ? (
        <VideoGeneratorStudio
          items={items}
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
          initialMode={initialMode}
        />
      )}
      </div>
    </div>
  );
}
