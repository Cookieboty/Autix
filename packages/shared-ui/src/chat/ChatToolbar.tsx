'use client';

import { useEffect } from 'react';
import { ChevronDown, Globe, ImagePlus, Lock, Settings } from 'lucide-react';
import {
  hasChatCapability,
  hasImageCapability,
  type AgentKind,
} from '@autix/shared-lib';
import { useChatStore } from '@autix/shared-store';
import { ImageParamsPopover } from './ImageParamsPopover';
import { ModelPickerPopover } from './ModelPickerPopover';
import { KIND_LABEL, isKindActive } from './agent-kind-utils';

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
  onOpenTemplateDrawer: () => void;
  labels?: {
    selectModel?: string;
    selectTemplate?: string;
    chatModelTooltip?: string;
    kindComingSoon?: (kindLabel: string) => string;
    modelPicker?: {
      searchPlaceholder?: string;
      recent?: string;
      empty?: string;
      clearSelection?: string;
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
    const comingSoon = labels?.kindComingSoon
      ? labels.kindComingSoon(KIND_LABEL[kind])
      : `${KIND_LABEL[kind]}模块即将上线`;
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {comingSoon}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* Model Picker */}
      <ModelPickerPopover
        candidates={primaryCandidates}
        value={primaryValue}
        onChange={(id) => id && setSelectedModel(id)}
        memoryKey={kind === 'image' ? 'image' : 'chat'}
        disabledClear
        labels={labels?.modelPicker}
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
          >
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-[120px] truncate">
              {primaryCandidates.find((m) => m.id === primaryValue)?.name ?? (labels?.selectModel ?? '选择模型')}
            </span>
            <ChevronDown className="h-3 w-3" />
          </button>
        }
      />

      {/* Chat model picker (right of primary model) */}
      {kind === 'image' && (
        <ModelPickerPopover
          candidates={chatCandidates}
          value={selectedChatModelId}
          onChange={setSelectedChatModel}
          memoryKey="chat"
          disabledClear={false}
          labels={labels?.modelPicker}
          trigger={
            <button
              type="button"
              className="inline-flex items-center justify-center size-7 rounded-lg border border-border text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              title={labels?.chatModelTooltip ?? '对话模型（用于 AI 总结 prompt）'}
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

          <button
            type="button"
            onClick={onOpenTemplateDrawer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
          >
            <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-[100px] truncate">
              {activeTemplateName ?? (labels?.selectTemplate ?? '选模板')}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
