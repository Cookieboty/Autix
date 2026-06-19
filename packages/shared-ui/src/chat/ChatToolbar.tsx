'use client';

import { useEffect } from 'react';
import { ChevronDown, Globe, ImagePlus, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  hasChatCapability,
  hasImageCapability,
  type AgentKind,
} from '@autix/sdk';
import { useChatStore } from '@autix/shared-store';
import { ImageParamsPopover } from './ImageParamsPopover';
import { ModelPickerPopover } from './ModelPickerPopover';
import { isKindActive } from './agent-kind-utils';
import { useModelConfigEnabled } from '../hooks/useModelConfigEnabled';
import { useRouter } from '../navigation';

interface ChatToolbarProps {
  kind: AgentKind;
  conversationId?: string;
  activeTemplateName?: string;
  imageSize: string;
  imageQuality: string;
  imageCount: number;
  onImageSizeChange: (v: string) => void;
  onImageQualityChange: (v: string) => void;
  onImageCountChange: (v: number) => void;
  onOpenTemplateDrawer?: () => void;
  onModelChange?: () => void;
  labels?: {
    selectModel?: string;
    selectTemplate?: string;
    chatModelTooltip?: string;
    noModelsGoConfig?: string;
    kindComingSoon?: (kindLabel: string) => string;
    modelPicker?: {
      searchPlaceholder?: string;
      empty?: string;
    };
  };
}

export function ChatToolbar({
  kind,
  activeTemplateName,
  imageSize,
  imageQuality,
  imageCount,
  onImageSizeChange,
  onImageQualityChange,
  onImageCountChange,
  onOpenTemplateDrawer,
  onModelChange,
  labels,
}: ChatToolbarProps) {
  const {
    availableModels,
    selectedModelId,
    setSelectedModel,
    selectedChatModelId,
    setSelectedChatModel,
    fetchAvailableModels,
  } = useChatStore();
  const router = useRouter();
  const modelConfigEnabled = useModelConfigEnabled(false);
  const t = useTranslations('chat');

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  const imageCandidates = availableModels.filter((m) =>
    hasImageCapability(m.capabilities ?? []),
  );
  const chatCandidates = availableModels.filter((m) =>
    hasChatCapability(m.capabilities ?? []),
  );
  const primaryCandidates = kind === 'image' ? imageCandidates : chatCandidates;
  const primaryValue = selectedModelId;

  if (!isKindActive(kind)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* Model Picker */}
      {primaryCandidates.length === 0 && modelConfigEnabled ? (
        <button
          type="button"
          onClick={() => router.push('/models')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary cursor-pointer"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="max-w-[160px] truncate">
            {labels?.noModelsGoConfig ?? t('noModelsGoConfig')}
          </span>
        </button>
      ) : primaryCandidates.length > 0 ? (
        <ModelPickerPopover
          candidates={primaryCandidates}
          value={primaryValue}
          onChange={(id) => {
            if (!id) return;
            const changed = id !== primaryValue;
            setSelectedModel(id);
            if (changed) onModelChange?.();
          }}
          labels={labels?.modelPicker}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="max-w-[120px] truncate">
                {primaryCandidates.find((m) => m.id === primaryValue)?.name ?? (labels?.selectModel ?? t('toolbar.selectModel'))}
              </span>
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        />
      ) : null}

      {/* Chat model picker (right of primary model) */}
      {kind === 'image' && chatCandidates.length > 0 && (
        <ModelPickerPopover
          candidates={chatCandidates}
          value={selectedChatModelId}
          onChange={(id) => {
            const changed = id !== selectedChatModelId;
            setSelectedChatModel(id);
            if (changed) onModelChange?.();
          }}
          labels={labels?.modelPicker}
          trigger={
            <button
              type="button"
              className="inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              title={labels?.chatModelTooltip ?? t('toolbar.chatModelTooltip')}
            >
              <Settings className="size-3.5" />
            </button>
          }
        />
      )}

      {/* Image-specific tools */}
      {kind === 'image' && (
        <>
          <ImageParamsPopover
            size={imageSize}
            quality={imageQuality}
            count={imageCount}
            onSizeChange={onImageSizeChange}
            onQualityChange={onImageQualityChange}
            onCountChange={onImageCountChange}
          />

          {onOpenTemplateDrawer && (
            <button
              type="button"
              onClick={onOpenTemplateDrawer}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="max-w-[100px] truncate">
                {activeTemplateName ?? (labels?.selectTemplate ?? t('toolbar.selectTemplate'))}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
