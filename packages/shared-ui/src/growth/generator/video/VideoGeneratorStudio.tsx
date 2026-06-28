'use client';

import type { ModelConfigItem } from '@autix/shared-store';
import type { PublicGrowthMediaItem } from '../../types';
import { VideoSidebar } from './VideoSidebar';
import { VideoHowItWorks } from './VideoHowItWorks';

export function VideoGeneratorStudio({
  items,
  workbenchHref,
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  onModelChange,
}: {
  items: PublicGrowthMediaItem[];
  workbenchHref: string;
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  onModelChange: (modelId: string) => void;
}) {
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
            items={items}
            initialModel={initialModel}
            videoModels={videoModels}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            selectedModelValue={selectedModelValue}
            modelsLoading={modelsLoading}
            onModelChange={onModelChange}
          />
        </div>
        <VideoHowItWorks items={items} workbenchHref={workbenchHref} />
      </div>
    </div>
  );
}
