'use client';

import { useEffect, useState } from 'react';
import {
  createLocalVideoProject,
  hasChatCapability,
  isVideoModel,
  listAvailableModels,
  publicGeneratorActions,
  useAuthStore,
  useUiStore,
  useVideoProjectStore,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { PublicGrowthMediaItem } from '../../types';
import { VideoSidebar } from './VideoSidebar';
import { VideoHowItWorks } from './VideoHowItWorks';
import type { PublicVideoGenerationPayload } from './public-video-generation';
import type { PendingVideoGenerationCard } from './VideoHistoryPanel';

export function VideoGeneratorStudio({
  items,
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  onModelChange,
}: {
  items: PublicGrowthMediaItem[];
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  onModelChange: (modelId: string) => void;
}) {
  const [tab, setTab] = useState<'history' | 'howItWorks'>('howItWorks');
  const [generating, setGenerating] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<PendingVideoGenerationCard | null>(null);
  const [textModels, setTextModels] = useState<ModelConfigItem[]>([]);
  const [textModelsLoading, setTextModelsLoading] = useState(true);
  const [selectedTextModelId, setSelectedTextModelId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const replaceDraftProject = useVideoProjectStore((state) => state.replaceDraftProject);
  const generateAll = useVideoProjectStore((state) => state.generateAll);
  const loadProjects = useVideoProjectStore((state) => state.loadProjects);

  useEffect(() => {
    // 优化模型列表用登录后的通用/对话模型（公开模型接口通常不含 chat 模型）；
    // 优化本身也需登录，未登录时不拉取，登录后再加载。
    if (!isAuthenticated) {
      setTextModels([]);
      setTextModelsLoading(false);
      return;
    }
    let cancelled = false;
    setTextModelsLoading(true);
    listAvailableModels()
      .then((models) => {
        if (cancelled) return;
        const candidates = models.filter(
          (item) => hasChatCapability(item.capabilities ?? []) && !isVideoModel(item),
        );
        setTextModels(candidates);
        setSelectedTextModelId((current) =>
          current && candidates.some((item) => item.id === current)
            ? current
            : candidates.find((item) => item.isDefault)?.id ?? candidates[0]?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setTextModels([]);
      })
      .finally(() => {
        if (!cancelled) setTextModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleOptimizePrompt = async (prompt: string): Promise<string | null> => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/video' });
      return null;
    }
    setOptimizing(true);
    try {
      return await publicGeneratorActions.optimizeVideoPrompt({
        prompt,
        modelId: selectedTextModelId ?? undefined,
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleGenerate = async (payload: PublicVideoGenerationPayload) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/video' });
      return;
    }
    setPendingGeneration({
      id: `pending-video-${Date.now()}`,
      title: payload.title,
      prompt: payload.prompt,
      model: String(payload.params.model ?? selectedModel?.name ?? selectedModelValue ?? ''),
      coverUrl: payload.materials[0]?.url ?? null,
    });
    setTab('history');
    setGenerating(true);
    try {
      const project = createLocalVideoProject(
        payload.title,
        [
          {
            title: payload.title,
            prompt: payload.prompt,
            params: payload.params,
            chainFromPrev: false,
          },
        ],
        payload.materials[0]?.url ?? null,
      );
      const clipId = project.clips[0]?.id;
      const projectWithMaterials = clipId
        ? {
            ...project,
            clips: project.clips.map((clip) =>
              clip.id === clipId
                ? {
                    ...clip,
                    materials: payload.materials.map((material, index) => ({
                      id: `public-video-material-${Date.now()}-${index}`,
                      clipId,
                      role: 'reference_image',
                      sourceType: material.sourceType ?? 'upload',
                      sourceId: material.sourceId ?? null,
                      url: material.url,
                      name: material.name ?? null,
                      metadata: material.prompt ? { prompt: material.prompt } : null,
                    })),
                  }
                : clip,
            ),
          }
        : project;
      replaceDraftProject(projectWithMaterials);
      setTab('history');
      await generateAll();
      const latestError = useVideoProjectStore.getState().lastError;
      if (latestError) throw new Error(latestError);
      await loadProjects();
    } finally {
      setGenerating(false);
      setPendingGeneration(null);
    }
  };

  return (
    <div className="relative min-h-[calc(100svh-104px)] bg-background">
      <div className="growth-video-studio-bg absolute inset-0" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.1]" />
      <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 lg:flex-row lg:px-6">
        {/* Keep the original DOM (form first, display second) so the display stays
            a direct flex child. Only flip the desktop visual order: form → right,
            display → left. Mobile keeps the form on top (source order). */}
        <div className="lg:order-2 lg:w-[320px] lg:shrink-0">
          <VideoSidebar
            initialModel={initialModel}
            videoModels={videoModels}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            selectedModelValue={selectedModelValue}
            modelsLoading={modelsLoading}
            generating={generating}
            onGenerate={handleGenerate}
            onModelChange={onModelChange}
            textModels={textModels}
            textModelsLoading={textModelsLoading}
            selectedTextModelId={selectedTextModelId}
            onTextModelChange={setSelectedTextModelId}
            optimizing={optimizing}
            onOptimizePrompt={handleOptimizePrompt}
          />
        </div>
        <VideoHowItWorks
          items={items}
          activeTab={tab}
          pendingGeneration={pendingGeneration}
          onTabChange={setTab}
        />
      </div>
    </div>
  );
}
