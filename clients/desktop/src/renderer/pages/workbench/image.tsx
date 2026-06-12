'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  getAvailableModels,
  hasImageCapability,
  imageTemplateApi,
  imageWorkbenchApi,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-lib';
import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/shared-lib/image-capabilities';
import {
  ImageStudioWorkspace,
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
  type ImageStudioReference,
} from '@autix/shared-ui/workbench';
import { Alert, AlertDescription, AlertTitle, Button } from '@autix/shared-ui/ui';
import type { ImageResultItem } from '@autix/shared-ui/chat';

function buildDefaultSettings(model?: ModelConfigItem | null): ImageStudioModelSettings {
  const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind(model)];
  return {
    size: cap.defaults.size,
    quality: cap.defaults.quality,
    count: cap.defaults.count,
    guidanceScale: 7,
    steps: 30,
    seed: '',
    promptTuning: '自动优化',
    stylePreset: '通用精修',
    negativePrompt: '',
  };
}

function uploadableRefs(urls: string[]): ImageStudioReference[] {
  return urls.map((url, index) => ({ url, index }));
}

function buildWorkbenchSettings(
  settings: ImageStudioModelSettings,
  options: { skipPromptTuning?: boolean } = {},
) {
  return {
    size: settings.size,
    quality: settings.quality,
    guidanceScale: settings.guidanceScale,
    steps: settings.steps,
    seed: settings.seed || undefined,
    promptTuning: settings.promptTuning,
    stylePreset: settings.stylePreset,
    negativePrompt: settings.negativePrompt || undefined,
    ...(options.skipPromptTuning ? { skipPromptTuning: true } : {}),
  };
}

export function ImageWorkbenchPage() {
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImageStudioModelSettings>(() => buildDefaultSettings());
  const [selectedSourceImages, setSelectedSourceImages] = useState<ImageStudioReference[]>([]);
  const [currentImages, setCurrentImages] = useState<ImageResultItem[]>([]);
  const [historyImages, setHistoryImages] = useState<ImageResultItem[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    getAvailableModels()
      .then(async (res) => {
        if (cancelled) return;
        const data = (res.data ?? []) as ModelConfigItem[];
        setModels(data);
        const imageModels = data.filter((m) => hasImageCapability(m.capabilities ?? []));
        const preferred = imageModels.find((m) => m.isDefault) ?? imageModels[0];
        if (preferred) {
          setSelectedModelId(preferred.id);
          setSettings(buildDefaultSettings(preferred));
        }

        try {
          const historyRes = await imageWorkbenchApi.history({ pageSize: 60 });
          if (cancelled) return;
          const restoredImages = (historyRes.data.items ?? []).flatMap((item) =>
            item.images.map((image) => ({
              url: image.url,
              prompt: image.prompt ?? item.resolvedPrompt,
              generationId: image.generationId,
              index: image.index,
            })),
          );
          setHistoryImages(restoredImages);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? `历史资产加载失败：${err.message}` : '历史资产加载失败');
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '模型加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    imageTemplateApi
      .list({ sort: 'popular', pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        setImageTemplates(res.data.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? `模板加载失败：${err.message}` : '模板加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const imageModels = useMemo(
    () => models.filter((m) => hasImageCapability(m.capabilities ?? [])),
    [models],
  );

  const handleGenerate = async (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => {
    const model = selectedModelId;
    const prompt = (payload.editInstruction ?? payload.promptOverride ?? '').trim();
    if (!model) {
      setError('请先配置并选择图片模型');
      return;
    }
    if (!prompt) {
      setError('请输入提示词');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const sourceImages = payload.sourceImages ?? selectedSourceImages;
      const referenceImages = uploadableRefs(payload.inputImages ?? []);
      const res = await imageWorkbenchApi.generate({
        model,
        chatModelId: selectedChatModelId ?? undefined,
        ...(payload.editInstruction ? { editInstruction: prompt } : { prompt }),
        n: settings.count,
        sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        settings: buildWorkbenchSettings(settings, { skipPromptTuning: true }),
      });
      const nextImages = (res.data.images ?? []).map((item, index) => ({
        url: item.url,
        prompt: item.prompt ?? res.data.prompt,
        generationId: item.generationId,
        index: item.index ?? index,
        sourceImages: item.sourceImages,
      }));
      setCurrentImages((prev) => [...prev, ...nextImages]);
      setHistoryImages((prev) => [...nextImages, ...prev]);
      setSelectedSourceImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefinePrompt = async (payload: {
    prompt: string;
    mode: 'generate' | 'edit';
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }): Promise<ImageStudioPromptRefinement> => {
    const model = selectedModelId;
    if (!model) throw new Error('请先配置并选择图片模型');
    const referenceImages = uploadableRefs(payload.inputImages ?? []);
    const res = await imageWorkbenchApi.refinePrompt({
      model,
      chatModelId: selectedChatModelId ?? undefined,
      prompt: payload.prompt,
      mode: payload.mode,
      sourceImages: payload.sourceImages,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      settings: buildWorkbenchSettings(settings),
    });
    return res.data;
  };

  const handleMergeAnnotation = async (payload: {
    imageUrl: string;
    overlayDataUrl: string;
  }) => {
    const res = await imageWorkbenchApi.mergeAnnotation(payload);
    return res.data.image;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error && (
        <div className="shrink-0 px-4 pt-4">
          <Alert variant="destructive" className="relative pr-24">
            <AlertCircle />
            <AlertTitle>工作台请求失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setError(null)}
            >
              关闭
            </Button>
          </Alert>
        </div>
      )}

      {loadingModels ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
          正在加载专业工作台...
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ImageStudioWorkspace
            imageModels={imageModels}
            availableModels={models}
            selectedModelId={selectedModelId}
            selectedChatModelId={selectedChatModelId}
            onModelChange={setSelectedModelId}
            onChatModelChange={setSelectedChatModelId}
            settings={settings}
            onSettingsChange={setSettings}
            selectedSourceImages={selectedSourceImages}
            onRemoveSourceImage={(index) =>
              setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index))
            }
            onClearSourceImages={() => setSelectedSourceImages([])}
            currentImages={currentImages}
            historyImages={historyImages}
            imageTemplates={imageTemplates}
            templatesLoading={templatesLoading}
            isGenerating={generating}
            onGenerate={handleGenerate}
            onRefinePrompt={handleRefinePrompt}
            onMergeAnnotation={handleMergeAnnotation}
            onSelectSourceImage={(image) =>
              setSelectedSourceImages((cur) =>
                cur.some((item) => item.url === image.url)
                  ? cur
                  : [...cur, image],
              )
            }
          />
        </div>
      )}
    </div>
  );
}
