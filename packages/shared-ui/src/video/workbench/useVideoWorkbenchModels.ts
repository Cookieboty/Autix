'use client';

import { useEffect, useState } from 'react';
import {
  hasChatCapability,
  isVideoModel,
  pricingActions,
  useModelConfigStore,
  type ModelConfigItem,
  type TaskModel,
} from '@autix/shared-store';

// video_generation 的 TaskModel 列表（携带 paramsSchema/pricingSchema/multiplier/
// discountFactor，spec §5.1）独立于 videoModels（ModelConfigItem，用于模型选择器/
// 分辨率兼容性等既有逻辑）单独拉取——两者字段不重叠，不合并，只按 modelConfigId 关联。
export function useVideoWorkbenchModels() {
  const [directorModels, setDirectorModels] = useState<ModelConfigItem[]>([]);
  const [directorModelId, setDirectorModelId] = useState<string | null>(null);
  const [directorModelsLoading, setDirectorModelsLoading] = useState(false);
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [videoModelsLoading, setVideoModelsLoading] = useState(false);
  const [videoTaskModels, setVideoTaskModels] = useState<TaskModel[]>([]);
  const loadAvailableModels = useModelConfigStore((s) => s.loadAvailableModels);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDirectorModelsLoading(true);
    setVideoModelsLoading(true);
    loadAvailableModels()
      .then((allModels) => {
        if (cancelled) return;
        const models = allModels.filter(
          (model) => hasChatCapability(model.capabilities ?? []) && !isVideoModel(model),
        );
        setDirectorModels(models);
        setVideoModels(allModels.filter(isVideoModel));
        setDirectorModelId((current) => current ?? models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setDirectorModels([]);
          setVideoModels([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDirectorModelsLoading(false);
          setVideoModelsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadAvailableModels]);

  return {
    directorModels,
    directorModelId,
    setDirectorModelId,
    directorModelsLoading,
    videoModels,
    videoModelsLoading,
    videoTaskModels,
  };
}
