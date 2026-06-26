'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  hasChatCapability,
  hasImageCapability,
  imageWorkbenchActions,
  listAvailableModels,
  type GenerationPricingEstimate,
  type ImageTemplate,
  type ImageWorkbenchHistoryItem,
  type MaterialAsset,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { ImageResultItem } from '../../chat/MessageBubble';
import type {
  ImageStudioModelSettings,
  ImageStudioReference,
} from '../ImageStudioWorkspace';
import { buildImageWorkbenchEstimateInput } from './pricing';
import { buildDefaultImageWorkbenchSettings } from './settings';

export interface ImageWorkbenchResourceOptions {
  initialTemplateId?: string | null;
  initialModelId?: string | null;
  onInitialTemplateCleared?: () => void;
  enableMaterials?: boolean;
  enableQuickEstimate?: boolean;
  selectDefaultChatModel?: boolean;
}

function normalizeModelHint(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findModelByHint(models: ModelConfigItem[], hint: string | null | undefined) {
  const normalizedHint = normalizeModelHint(hint);
  if (!normalizedHint) return null;
  return models.find((model) =>
    [
      model.id,
      model.name,
      model.model,
      `${model.provider ?? ''} ${model.model ?? ''}`,
    ].some((candidate) => normalizeModelHint(candidate).includes(normalizedHint)),
  ) ?? null;
}

export function useImageWorkbenchResources({
  initialTemplateId = null,
  initialModelId = null,
  onInitialTemplateCleared,
  enableMaterials = false,
  enableQuickEstimate = false,
  selectDefaultChatModel = false,
}: ImageWorkbenchResourceOptions) {
  const t = useTranslations('imageStudio.page');
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImageStudioModelSettings>(() =>
    buildDefaultImageWorkbenchSettings(),
  );
  const [selectedSourceImages, setSelectedSourceImages] = useState<ImageStudioReference[]>([]);
  const [currentImages, setCurrentImages] = useState<ImageResultItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ImageWorkbenchHistoryItem[]>([]);
  const [materialImages, setMaterialImages] = useState<MaterialAsset[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([]);
  const [initialTemplate, setInitialTemplate] = useState<ImageTemplate | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [materialsLoading, setMaterialsLoading] = useState(enableMaterials);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickEstimate, setQuickEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [quickEstimateLoading, setQuickEstimateLoading] = useState(false);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listAvailableModels()
      .then(async (data) => {
        if (cancelled) return;
        setModels(data);
        const imageModels = data.filter((m) => hasImageCapability(m.capabilities ?? []));
        const preferred =
          findModelByHint(imageModels, initialModelId) ??
          imageModels.find((m) => m.isDefault) ??
          imageModels[0];
        if (preferred) {
          setSelectedModelId(preferred.id);
          setSettings(buildDefaultImageWorkbenchSettings(preferred));
        }
        if (selectDefaultChatModel) {
          const chatModels = data.filter((m) => hasChatCapability(m.capabilities ?? []));
          const preferredChat = chatModels.find((m) => m.isDefault) ?? chatModels[0];
          setSelectedChatModelId((current) => current ?? preferredChat?.id ?? null);
        }

        try {
          const loadedHistoryItems = await imageWorkbenchActions.listHistory({ pageSize: 60 });
          if (cancelled) return;
          setHistoryItems(loadedHistoryItems);
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? t('historyLoadFailedWithMessage', { message: err.message })
                : t('historyLoadFailed'),
            );
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('modelLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialModelId, selectDefaultChatModel, t]);

  const refreshMaterialImages = async () => {
    const items = await imageWorkbenchActions.listMaterials({ type: 'image', pageSize: 80 });
    setMaterialImages(items);
  };

  useEffect(() => {
    if (!enableMaterials) {
      setMaterialImages([]);
      setMaterialsLoading(false);
      return;
    }
    let cancelled = false;
    setMaterialsLoading(true);
    imageWorkbenchActions
      .listMaterials({ type: 'image', pageSize: 80 })
      .then((items) => {
        if (!cancelled) setMaterialImages(items);
      })
      .catch(() => {
        if (!cancelled) setMaterialImages([]);
      })
      .finally(() => {
        if (!cancelled) setMaterialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enableMaterials]);

  useEffect(() => {
    let cancelled = false;
    imageWorkbenchActions
      .getAccountBalance()
      .then((balance) => {
        if (cancelled) return;
        setAccountBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setAccountBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedModelId, settings.quality, settings.size]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    imageWorkbenchActions
      .listTemplates({ sort: 'popular', pageSize: 50 })
      .then(async (items) => {
        if (cancelled) return;
        let nextInitialTemplate =
          initialTemplateId ? items.find((item) => item.id === initialTemplateId) ?? null : null;
        if (initialTemplateId && !nextInitialTemplate) {
          try {
            nextInitialTemplate = await imageWorkbenchActions.getTemplate(initialTemplateId);
          } catch {
            nextInitialTemplate = null;
          }
        }
        if (cancelled) return;
        setImageTemplates(
          nextInitialTemplate && !items.some((item) => item.id === nextInitialTemplate?.id)
            ? [nextInitialTemplate, ...items]
            : items,
        );
        setInitialTemplate(nextInitialTemplate);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? t('templateLoadFailedWithMessage', { message: err.message })
              : t('templateLoadFailed'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialTemplateId]);

  const imageModels = useMemo(
    () => models.filter((m) => hasImageCapability(m.capabilities ?? [])),
    [models],
  );
  const selectedModel = imageModels.find((m) => m.id === selectedModelId) ?? null;

  useEffect(() => {
    if (!enableQuickEstimate) {
      setQuickEstimate(null);
      setQuickEstimateLoading(false);
      return;
    }
    if (!selectedModelId || !selectedModel) {
      setQuickEstimate(null);
      setQuickEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setQuickEstimateLoading(true);
    const timer = window.setTimeout(() => {
      imageWorkbenchActions
        .estimateGeneration(
          buildImageWorkbenchEstimateInput({
            settings,
            model: selectedModel,
            selectedModelId,
            referenceImages: selectedSourceImages.length,
          }),
        )
        .then((nextEstimate) => {
          if (!cancelled) setQuickEstimate(nextEstimate);
        })
        .catch(() => {
          if (!cancelled) setQuickEstimate(null);
        })
        .finally(() => {
          if (!cancelled) setQuickEstimateLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enableQuickEstimate,
    selectedModelId,
    selectedModel,
    settings.quality,
    settings.size,
    selectedSourceImages.length,
  ]);

  const handleClearTemplate = () => {
    setInitialTemplate(null);
    if (!initialTemplateId) return;
    onInitialTemplateCleared?.();
  };

  return {
    accountBalance,
    currentImages,
    enableMaterials,
    error,
    handleClearTemplate,
    historyItems,
    imageModels,
    imageTemplates,
    initialTemplate,
    loadingModels,
    loadingWorkbenchLabel: t('loadingWorkbench'),
    materialImages,
    materialsLoading,
    models,
    quickEstimate,
    quickEstimateLoading,
    refreshMaterialImages,
    selectedChatModelId,
    selectedModel,
    selectedModelId,
    selectedSourceImages,
    setAccountBalance,
    setCurrentImages,
    setError,
    setHistoryItems,
    setMaterialImages,
    setSelectedChatModelId,
    setSelectedModelId,
    setSelectedSourceImages,
    setSettings,
    settings,
    templatesLoading,
  };
}
