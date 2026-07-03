'use client';

import { useEffect, useMemo } from 'react';
import { ChevronDown, Globe, Image as ImageIcon, ImagePlus, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  buildImageSizeView,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/domain/image';
import {
  hasChatCapability,
  hasImageCapability,
  useChatStore,
  type AgentKind,
} from '@autix/shared-store';
import { ImageParamsPopover } from './ImageParamsPopover';
import { ModelPickerPopover } from './ModelPickerPopover';
import { isKindActive } from './agent-kind-utils';

interface ChatToolbarProps {
  kind: AgentKind;
  conversationId?: string;
  activeTemplateName?: string;
  imageSize: string;
  imageQuality: string;
  onImageSizeChange: (v: string) => void;
  onImageQualityChange: (v: string) => void;
  onOpenTemplateDrawer?: () => void;
  onModelChange?: () => void;
  labels?: {
    selectModel?: string;
    selectTemplate?: string;
    chatModelTooltip?: string;
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
  onImageSizeChange,
  onImageQualityChange,
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

  // 图片模式需要一个文本对话模型来理解需求并驱动生图工具。若尚未选择，默认选中第一个可用对话模型，
  // 确保发送请求时一定携带 chatModelId，避免后端回退到不支持对话的默认模型。
  useEffect(() => {
    if (kind !== 'image') return;
    if (selectedChatModelId) return;
    if (chatCandidates.length === 0) return;
    setSelectedChatModel(chatCandidates[0].id);
  }, [kind, selectedChatModelId, chatCandidates, setSelectedChatModel]);
  const primaryCandidates = kind === 'image' ? imageCandidates : chatCandidates;
  const primaryValue = selectedModelId;
  const selectedImageModel = kind === 'image'
    ? imageCandidates.find((model) => model.id === selectedModelId) ?? imageCandidates[0]
    : null;
  const imageCapability = IMAGE_MODEL_CAPABILITIES[detectImageModelKind(selectedImageModel)];
  const imageQualityOptions = useMemo(
    () => imageCapability.qualities.map((option) => ({
      value: option.value,
      label: t(`imageParams.qualityValue.${option.value}` as any),
    })),
    [imageCapability, t],
  );

  useEffect(() => {
    if (kind !== 'image') return;
    // 切换模型后旧尺寸若非法，归一化到最接近的合法长宽比（与图片工作台一致），
    // 而非粗暴回退到默认 1:1。
    const sizeView = buildImageSizeView(imageCapability, imageSize);
    if (!sizeView.isValid) {
      onImageSizeChange(sizeView.value);
    }
    if (imageCapability.qualities.length === 0) {
      if (imageQuality !== '') onImageQualityChange('');
      return;
    }
    if (!imageCapability.qualities.some((option) => option.value === imageQuality)) {
      onImageQualityChange(imageCapability.defaults.quality);
    }
  }, [
    imageCapability,
    imageQuality,
    imageSize,
    kind,
    onImageQualityChange,
    onImageSizeChange,
  ]);

  if (!isKindActive(kind)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* Model Picker */}
      {primaryCandidates.length > 0 ? (
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
              {kind === 'image' ? (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              )}
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
              title={labels?.chatModelTooltip ?? t('toolbar.chatModelTooltip')}
            >
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="max-w-[120px] truncate">
                {chatCandidates.find((m) => m.id === selectedChatModelId)?.name ?? (labels?.selectModel ?? t('toolbar.selectModel'))}
              </span>
              <ChevronDown className="h-3 w-3" />
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
            capability={imageCapability}
            qualityOptions={imageQualityOptions}
            onSizeChange={onImageSizeChange}
            onQualityChange={onImageQualityChange}
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
