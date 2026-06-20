'use client';

import { useEffect, useState } from 'react';
import {
  hasChatCapability,
  isVideoModel,
  useModelConfigStore,
  type ModelConfigItem,
} from '@autix/shared-store';

export function useVideoWorkbenchModels() {
  const [directorModels, setDirectorModels] = useState<ModelConfigItem[]>([]);
  const [directorModelId, setDirectorModelId] = useState<string | null>(null);
  const [directorModelsLoading, setDirectorModelsLoading] = useState(false);
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [videoModelsLoading, setVideoModelsLoading] = useState(false);
  const loadAvailableModels = useModelConfigStore((s) => s.loadAvailableModels);

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
  };
}
