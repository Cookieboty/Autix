'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createLocalVideoProject,
  useAuthStore,
  useUiStore,
  useVideoProjectStore,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { PublicGrowthMediaItem } from '../../types';
import { GenerationOverlay } from '../GenerationOverlay';
import { VideoSidebar } from './VideoSidebar';
import { VideoHowItWorks } from './VideoHowItWorks';
import type { PublicVideoGenerationPayload } from './public-video-generation';

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
  const t = useTranslations('publicGrowth.generator.studio');
  const [tab, setTab] = useState<'history' | 'howItWorks'>('howItWorks');
  const [generating, setGenerating] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const replaceDraftProject = useVideoProjectStore((state) => state.replaceDraftProject);
  const generateAll = useVideoProjectStore((state) => state.generateAll);
  const loadProjects = useVideoProjectStore((state) => state.loadProjects);

  const handleGenerate = async (payload: PublicVideoGenerationPayload) => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: '/ai/video' });
      return;
    }
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
    }
  };

  return (
    <div className="relative min-h-[calc(100svh-104px)] bg-background">
      <GenerationOverlay
        active={generating}
        title={t('generating')}
        description={t('generatingVideoHint')}
      />
      <div className="growth-video-studio-bg absolute inset-0" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.1]" />
      <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 lg:flex-row lg:px-6">
        {/* Keep the original DOM (form first, display second) so the display stays
            a direct flex child. Only flip the desktop visual order: form → right,
            display → left. Mobile keeps the form on top (source order). */}
        <div className="lg:order-2 lg:w-[320px] lg:shrink-0">
          <VideoSidebar
            items={items}
            initialModel={initialModel}
            videoModels={videoModels}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            selectedModelValue={selectedModelValue}
            modelsLoading={modelsLoading}
            generating={generating}
            onGenerate={handleGenerate}
            onModelChange={onModelChange}
          />
        </div>
        <VideoHowItWorks items={items} activeTab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}
