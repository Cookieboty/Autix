'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelCapability,
} from '@autix/domain/image';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import {
  hasImageCapability,
  isVideoModel,
  listPublicAvailableModels,
  pricingActions,
  type ModelConfigItem,
  type TaskModel,
} from '@autix/shared-store';
import { getFallbackItems } from './fallback';
import {
  findImageModelByHint,
  resolveImageCapabilityFromModelParam,
} from './generator-image-presenters';
import { findVideoModelByHint } from './generator-video-presenters';
import { buildDiscountTranslationValues } from './discount';
import { SetPublicTopPromo } from './PublicTopPromo';
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
  initialPrompt,
}: {
  kind: GeneratorKind;
  examples?: PublicGrowthMediaItem[] | null;
  initialModel?: string | null;
  initialMode?: ImageStudioMode;
  /** 生成器 Tab 初值（?mode=gallery），image / video 共用。 */
  initialPrompt?: string | null;
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

  // image_generation 的 TaskModel 列表（paramsSchema/pricingSchema/multiplier/
  // discountFactor）——沿用已删除的图片工作台前端既有的取法，
  // 独立于 imageModels（ModelConfigItem，驱动模型选择器）单独拉取，按 modelConfigId
  // 关联给 ImageComposer 用。paramsSchema 缺失 -> ImageComposer 不渲染参数控件
  // （spec §12：DEFAULT_IMAGE_KIND「未识别模型拿到别的模型尺寸表」的洞由此消失）。
  const [imageTaskModels, setImageTaskModels] = useState<TaskModel[]>([]);
  useEffect(() => {
    if (kind !== 'image') return;
    let cancelled = false;
    pricingActions
      .getTaskModels('image_generation')
      .then((models) => {
        if (!cancelled) setImageTaskModels(models);
      })
      .catch(() => {
        if (!cancelled) setImageTaskModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);
  const selectedImageTaskModel = imageTaskModels.find(
    (model) => model.modelConfigId === selectedImageModelId,
  );
  const imageParamsSchema = selectedImageTaskModel?.paramsSchema as unknown as ParamsSchema | undefined;
  const imagePricingSchema = selectedImageTaskModel?.pricingSchema as unknown as PricingSchema | undefined;
  const imagePricingContext = {
    multiplier: selectedImageTaskModel?.multiplier ?? 1,
    discountFactor: selectedImageTaskModel?.discountFactor ?? 1,
  };

  // video_generation 的 TaskModel 列表（paramsSchema/pricingSchema/multiplier/
  // discountFactor）——与 image 完全同构地单独拉取，按 modelConfigId 关联给 VideoSidebar
  // 做**本地即时计价**，取代原来每次改参数都打 /points/estimate 的服务端往返。
  // video_generation 与 image_generation 一样 fixedCostSchema 为 null（presets.ts），
  // 所以前端本地 computeTaskEstimate（taskFixedSchema: null）与服务端扣费同函数同结果。
  const [videoTaskModels, setVideoTaskModels] = useState<TaskModel[]>([]);
  useEffect(() => {
    if (kind !== 'video') return;
    let cancelled = false;
    pricingActions
      .getTaskModels('video_generation')
      .then((models) => {
        if (!cancelled) setVideoTaskModels(models);
      })
      .catch(() => {
        if (!cancelled) setVideoTaskModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);
  const selectedVideoTaskModel = videoTaskModels.find(
    (model) => model.modelConfigId === selectedVideoModelId,
  );
  const videoParamsSchema = selectedVideoTaskModel?.paramsSchema as unknown as ParamsSchema | undefined;
  const videoPricingSchema = selectedVideoTaskModel?.pricingSchema as unknown as PricingSchema | undefined;
  // 必须 memo：裸对象字面量每次渲染都是新引用，VideoSidebar 里以它为依赖的
  // 估价 effect 会每渲染重跑一次 computeTaskEstimate。目前靠 setState 的值相等
  // bailout 兜住没炸，但只要 total 出现一次 NaN（NaN !== NaN，永不 bailout）
  // 就会变成无限渲染循环。
  const videoPricingContext = useMemo(
    () => ({
      multiplier: selectedVideoTaskModel?.multiplier ?? 1,
      discountFactor: selectedVideoTaskModel?.discountFactor ?? 1,
    }),
    [selectedVideoTaskModel?.multiplier, selectedVideoTaskModel?.discountFactor],
  );

  useEffect(() => {
    if (kind !== 'image') {
      setImageModelsLoading(false);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // 拉取公开可用图片模型；接口偶发失败时重试一次，避免进入页面时模型列表加载不出来
    const load = (attempt: number) => {
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
          setImageModelsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 1) {
            retryTimer = setTimeout(() => load(attempt + 1), 600);
          } else {
            setImageModels([]);
            setSelectedImageModelId(null);
            setImageModelsLoading(false);
          }
        });
    };
    load(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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
    <div className="relative flex h-full flex-col text-foreground">
      {/* 功能页横幅内容（由 (public) layout 在导航上方渲染） */}
      <SetPublicTopPromo
        label={t('generator.studio.topPromo', buildDiscountTranslationValues())}
        href="/pricing"
      />
      {/* 背景统一由全局默认背景（body 的 --background）提供，功能页不再自带渐变/噪点层 */}
      {/* 导航与顶部横幅均由 (public) layout 持久提供 */}
      {/* studio 区占满剩余高度（定高）：image 内部自管滚动；video 在此容器内滚动 */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-none">
        {kind === 'video' ? (
        <VideoGeneratorStudio
          initialModel={initialModel}
          videoModels={videoModels}
          selectedModel={selectedVideoModel}
          selectedModelId={selectedVideoModelId}
          selectedModelValue={selectedVideoModelValue}
          modelsLoading={videoModelsLoading}
          paramsSchema={videoParamsSchema}
          pricingSchema={videoPricingSchema}
          pricingContext={videoPricingContext}
          onModelChange={setSelectedVideoModelId}
          initialMode={initialMode}
          /* 同 image：Web 端才写地址栏 */
          syncUrl
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
          paramsSchema={imageParamsSchema}
          pricingSchema={imagePricingSchema}
          pricingContext={imagePricingContext}
          onModelChange={setSelectedImageModelId}
          initialMode={initialMode}
          initialPrompt={initialPrompt}
          /* Web 端才写地址栏（桌面端是 HashRouter，地址栏对用户不可见） */
          syncUrl
        />
      )}
      </div>
    </div>
  );
}
