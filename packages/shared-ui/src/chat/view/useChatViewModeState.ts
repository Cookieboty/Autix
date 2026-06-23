'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  conversationActions,
  isVideoModel,
  marketplaceActions,
  type AgentKind,
  type ChatSession,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { InputMode } from '../InputModeSwitch';
import type { SourceImageRef } from '../chat-source-images';
import { resolveActiveAgentKind, toVisibleInputMode } from '../chat-mode';
import { useChatInputEstimate } from '../useChatInputEstimate';
import { useConversationResources } from '../useConversationResources';
import { useImageModelDefaults } from '../useImageModelDefaults';
import { useTemplatePromptState } from '../useTemplatePromptState';
import { composeTemplatePrompt } from '../utils/composeTemplatePrompt';
import { useVideoInputController } from '../../video/useVideoInputController';
import {
  getActiveTemplateSummary,
  getGeneratedImages,
  getSelectedVideoModel,
} from './chatViewModel';
import type { ChatViewMessage } from './chat-view-types';

interface UseChatViewModeStateParams {
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  aiUIMessages: ChatViewMessage[];
  availableModels: ModelConfigItem[];
  closeSidebar?: () => void;
  isImageWorkflowRunning: boolean;
  selectedModelId: string | null;
  setChatError: (error: string | null) => void;
  setSelectedModel: (id: string) => void;
  setSessionKind: (id: string, kind: ChatSession['kind']) => void;
  switchModeFailedMessage: string;
}

export function useChatViewModeState({
  activeSessionId,
  activeSession,
  aiUIMessages,
  availableModels,
  closeSidebar,
  isImageWorkflowRunning,
  selectedModelId,
  setChatError,
  setSelectedModel,
  setSessionKind,
  switchModeFailedMessage,
}: UseChatViewModeStateParams) {
  const [imageSize, setImageSize] = useState('auto');
  const [imageQuality, setImageQuality] = useState('medium');
  const [selectedSourceImages, setSelectedSourceImages] = useState<SourceImageRef[]>([]);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [composerResetToken, setComposerResetToken] = useState(0);
  const [inputModeOverride, setInputModeOverride] = useState<InputMode | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const videoInput = useVideoInputController({
    appendAdditionalFirstLastWhenFull: true,
  });

  const {
    activeAgent,
    activeImageTemplate,
    activeVideoTemplate,
    imageTemplateResource,
    videoTemplateResource,
    refreshResources,
    detachActiveTemplates,
  } = useConversationResources(activeSessionId);

  const selectedModel = availableModels.find((model) => model.id === selectedModelId);
  const selectedImageModel =
    selectedModel && selectedModel.capabilities?.includes('image')
      ? selectedModel
      : null;
  const videoModels = useMemo(
    () => availableModels.filter(isVideoModel),
    [availableModels],
  );
  const selectedVideoModel = useMemo(() => {
    const value = videoInput.model || videoTemplateResource?.modelHint || '';
    return getSelectedVideoModel(videoModels, value);
  }, [videoInput.model, videoModels, videoTemplateResource?.modelHint]);
  const modelSupportsVision = selectedModel?.capabilities?.includes('vision') ?? false;
  const generatedImages = getGeneratedImages(aiUIMessages);
  const hasImageHistory =
    generatedImages.length > 0 || isImageWorkflowRunning || Boolean(activeImageTemplate);
  const activeKind = resolveActiveAgentKind({
    inputModeOverride,
    sessionKind: activeSession?.kind,
    agentKind: activeAgent?.kind,
    hasActiveVideoTemplate: Boolean(activeVideoTemplate),
    hasImageHistory,
  });
  const inputKind: AgentKind = activeKind;
  const visibleInputMode = toVisibleInputMode(activeKind);
  const activeModeTemplate = activeKind === 'video' ? activeVideoTemplate : activeImageTemplate;
  const activeModeTemplateResource = activeKind === 'video' ? videoTemplateResource : imageTemplateResource;
  const activeModeTemplateResourceType = activeKind === 'video' ? 'VIDEO_TEMPLATE' : 'IMAGE_TEMPLATE';

  const {
    templateVariables,
    setTemplateVariables,
    promptDialogOpen,
    setPromptDialogOpen,
    selectedRefImages,
    setSelectedRefImages,
    promptInject,
    setPromptInject,
    clearPromptState,
  } = useTemplatePromptState({
    activeImageTemplateId: activeImageTemplate?.resourceId,
    activeVideoTemplateId: activeVideoTemplate?.resourceId,
    imageTemplateResource,
    videoTemplateResource,
    videoInput,
  });

  const clearComposerContent = () => {
    clearPromptState();
    setSelectedSourceImages([]);
    setComposerResetToken((token) => token + 1);
  };

  const handleToolbarModelChange = () => {
    clearComposerContent();
  };

  const handleVideoModelChange = (id: string) => {
    const shouldClear = Boolean(videoInput.model) && id !== videoInput.model;
    videoInput.setModel(id);
    if (shouldClear) clearComposerContent();
  };

  useEffect(() => {
    if (activeKind === 'video' && selectedVideoModel?.id && videoInput.model !== selectedVideoModel.id) {
      videoInput.setModel(selectedVideoModel.id);
    }
  }, [activeKind, selectedVideoModel, videoInput.model, videoInput.setModel]);

  const {
    estimate: inputEstimate,
    loading: inputEstimateLoading,
  } = useChatInputEstimate({
    activeSessionId,
    activeKind,
    imageQuality,
    imageSize,
    selectedImageModel,
    selectedSourceImageCount: selectedSourceImages.length,
    usesImageTemplate: Boolean(activeImageTemplate?.resourceId),
    selectedVideoModel,
    videoResolutionValue: videoTemplateResource?.defaultParams?.resolution,
    videoDuration: videoInput.duration,
    videoGenMode: videoInput.mode,
    videoMaterials: videoInput.materials,
    videoFrames: videoInput.frames,
  });

  const toggleSourceImage = (image: SourceImageRef) => {
    setSelectedSourceImages((cur) =>
      cur.some((item) => item.url === image.url)
        ? cur.filter((item) => item.url !== image.url)
        : [...cur, image],
    );
  };

  useEffect(() => {
    setInputModeOverride(null);
  }, [activeSessionId]);

  const handleInputModeChange = async (mode: InputMode) => {
    if (!activeSessionId || isSwitchingMode || mode === visibleInputMode) return;

    const previousKind = activeSession?.kind ?? 'chat';
    setIsSwitchingMode(true);
    setInputModeOverride(mode);
    setSessionKind(activeSessionId, mode);
    clearComposerContent();
    setChatError(null);

    try {
      await conversationActions.updateConversationKind(activeSessionId, mode);
      await detachActiveTemplates(activeSessionId);
      window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      await refreshResources();
    } catch (err: unknown) {
      setInputModeOverride(
        previousKind === 'image' || previousKind === 'video'
          ? previousKind
          : 'chat',
      );
      setSessionKind(activeSessionId, previousKind);
      setChatError(err instanceof Error ? err.message : switchModeFailedMessage);
    } finally {
      setIsSwitchingMode(false);
    }
  };

  useImageModelDefaults({
    imageTemplateResource,
    setSelectedModel,
    setSelectedSourceImages,
    setTemplateVariables,
  });

  const activeTemplateSummary = getActiveTemplateSummary({
    inputKind,
    activeModeTemplate,
    activeModeTemplateResource,
    imageTemplateResource,
  });

  const handleRemoveSourceImage = (index: number) => {
    setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index));
  };

  const handleOpenTemplateDrawer = () => {
    setTemplateSheetOpen(true);
    closeSidebar?.();
  };

  const handleReuseTemplate = activeTemplateSummary
    ? () => {
      const composed = composeTemplatePrompt(
        activeModeTemplateResource?.prompt ?? '',
        templateVariables,
      );
      setPromptInject((prev) => ({
        content: composed,
        images: inputKind === 'image' ? selectedRefImages : undefined,
        token: (prev?.token ?? 0) + 1,
      }));
    }
    : undefined;

  const handleRemoveTemplate = inputKind === 'image' || inputKind === 'video'
    ? () => {
      clearComposerContent();
      if (activeModeTemplate?.resourceId && activeSessionId) {
        marketplaceActions.detachConversationResource(
          activeSessionId,
          activeModeTemplateResourceType,
          activeModeTemplate.resourceId,
        ).then(() => {
          window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
        });
      }
    }
    : undefined;

  const handleTemplatePromptApply = (
    composed: string,
    values: Record<string, string>,
    refs: string[],
  ) => {
    setTemplateVariables(values);
    setSelectedRefImages(refs);
    if (activeKind === 'video') {
      videoInput.applyRefs(refs);
    }
    setPromptInject((prev) => ({
      content: composed,
      images: activeKind === 'image' ? refs : undefined,
      token: (prev?.token ?? 0) + 1,
    }));
    setPromptDialogOpen(false);
  };

  return {
    activeImageTemplate,
    activeKind,
    activeModeTemplate,
    activeTemplateSummary,
    activeVideoTemplate,
    composerResetToken,
    generatedImages,
    handleInputModeChange,
    handleOpenTemplateDrawer,
    handleRemoveSourceImage,
    handleRemoveTemplate,
    handleReuseTemplate,
    handleTemplatePromptApply,
    handleToolbarModelChange,
    handleVideoModelChange,
    imageQuality,
    imageSize,
    imageTemplateResource,
    inputEstimate,
    inputEstimateLoading,
    inputKind,
    isLocked: (activeSession?.messages?.length ?? 0) > 0,
    isSwitchingMode,
    modelSupportsVision,
    promptDialogOpen,
    promptInject,
    refreshResources,
    selectedRefImages,
    selectedSourceImages,
    selectedVideoModel,
    setImageQuality,
    setImageSize,
    setPromptDialogOpen,
    setSelectedSourceImages,
    setTemplateSheetOpen,
    setTemplateVariables,
    templateSheetOpen,
    templateVariables,
    toggleSourceImage,
    videoInput,
    videoModels,
    videoTemplateResource,
    visibleInputMode,
    activeModeTemplateResource: activeModeTemplateResource,
  };
}
