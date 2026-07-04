'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../../navigation';
import { useChatStore } from '@autix/shared-store';
import { mapSessionMessagesToAIUIMessages } from '../chat-history-mapper';
import { useAIUIStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useResourcePanelStore } from '@autix/shared-store';
import { useIsElectron } from '../../hooks/useIsElectron';
import { useOptionalSidebar } from '../../ui/sidebar';
import { useChatStreamMessageHandler } from '../useChatStreamMessageHandler';
import { useTranslations } from 'next-intl';
import { useChatViewImageGeneration } from './useChatViewImageGeneration';
import { useChatViewModeState } from './useChatViewModeState';
import { useChatViewSending } from './useChatViewSending';
import { useChatViewSessionEffects } from './useChatViewSessionEffects';

interface UseChatViewControllerParams {
  /** 如果由 URL 参数提供，则直接激活该会话 */
  sessionId?: string;
}

export function useChatViewController({ sessionId }: UseChatViewControllerParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isElectron = useIsElectron();
  const sidebarCtx = useOptionalSidebar();
  const t = useTranslations('chat');
  const {
    activeSessionId,
    fetchSessions,
    createSession,
    setActiveSession,
    reloadSessionMessages,
    addMessage,
    appendToLastAssistantMessage,
    setStreaming,
    isStreaming,
    getActiveSession,
    isLoadingSessions,
    selectedModelId,
    setSelectedModel,
    selectedChatModelId,
    availableModels,
    fetchAvailableModels,
    setSessionKind,
  } = useChatStore();

  const {
    messages: aiUIMessages,
    streamingMessage,
    isWaitingForUser,
    currentProgress,
    addMessage: addAIUIMessage,
    setMessages: setAIUIMessages,
    updateStreamingMessage,
    finalizeStreaming: finalizeAIUIStreaming,
    setStage,
    setProgress,
    clearProgress,
  } = useAIUIStore();

  const {
    activeArtifact,
    clearArtifact,
    loadArtifactByConversation,
    loadArtifactById,
  } = useArtifactStore();
  const setResourcePanelConversationId = useResourcePanelStore((s) => s.setActiveConversationId);
  const openResourcePanel = useResourcePanelStore((s) => s.openPanel);

  const abortRef = useRef<AbortController | null>(null);
  const [, setIsWaitingFirstResponse] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isImageWorkflowRunning, setIsImageWorkflowRunning] = useState(false);
  const imageWorkflowRunningRef = useRef(false);

  const activeSession = getActiveSession();
  const modeState = useChatViewModeState({
    activeSessionId,
    activeSession,
    aiUIMessages,
    availableModels,
    closeSidebar: () => {
      if (sidebarCtx?.open) sidebarCtx.setOpen(false);
    },
    isImageWorkflowRunning,
    selectedModelId,
    setChatError,
    setSelectedModel,
    setSessionKind,
    switchModeFailedMessage: t('error.switchModeFailed'),
  });

  const {
    activeImageTemplate,
    activeKind,
    activeModeTemplate,
    activeTemplateSummary,
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
    isLocked,
    isSwitchingMode,
    modelSupportsVision,
    promptDialogOpen,
    promptInject,
    refreshResources,
    selectedRefImages,
    selectedSourceImages,
    setImageQuality,
    setImageSize,
    setPromptDialogOpen,
    setSelectedSourceImages,
    setTemplateSheetOpen,
    templateSheetOpen,
    templateVariables,
    toggleSourceImage,
    videoInput,
    videoModels,
    videoTemplateResource,
    visibleInputMode,
  } = modeState;

  // 流式生图完成后：强制从后端拉取消息，并显式重映射到 aiUIMessages。
  // 不能只依赖会话对账 effect —— 乐观占位消息（用户 + 空 assistant）与后端消息（用户 + 图片 assistant）
  // 条数相同，effect 的 messages.length 依赖不变、不会触发，因此这里直接重刷。
  const resyncMessagesFromServer = useCallback(
    async (conversationId: string) => {
      await reloadSessionMessages(conversationId);
      const session = useChatStore
        .getState()
        .sessions.find((item) => item.id === conversationId);
      if (session) {
        setAIUIMessages(mapSessionMessagesToAIUIMessages(session.messages));
      }
    },
    [reloadSessionMessages, setAIUIMessages],
  );

  const handleChatStreamMessage = useChatStreamMessageHandler({
    abortRef,
    addAIUIMessage,
    appendToLastAssistantMessage,
    clearProgress,
    finalizeAIUIStreaming,
    imageWorkflowRunningRef,
    loadArtifactById,
    reloadSessionMessages: resyncMessagesFromServer,
    setChatError,
    setIsImageWorkflowRunning,
    setIsWaitingFirstResponse,
    setProgress,
    setSelectedSourceImages,
    setStage,
    setStreaming,
    unknownErrorMessage: t('unknownError'),
    updateStreamingMessage,
  });

  useChatViewSessionEffects({
    activeSession,
    activeSessionId,
    availableModelCount: availableModels.length,
    clearArtifact,
    createSession,
    fetchAvailableModels,
    fetchSessions,
    isStreaming,
    loadArtifactByConversation,
    newConversationTitle: t('newConversation'),
    openResourcePanel,
    router,
    searchParams,
    sessionId,
    setActiveSession,
    setAIUIMessages,
    setResourcePanelConversationId,
  });

  const {
    handleGenerateImage,
    handleGenerateImageFromInput,
  } = useChatViewImageGeneration({
    abortRef,
    activeImageTemplateId: activeImageTemplate?.resourceId,
    activeSessionId,
    addAIUIMessage,
    addMessage,
    finalizeAIUIStreaming,
    imageQuality,
    imageSize,
    imageWorkflowRunningRef,
    imageUploadFailedMessage: t('error.imageUploadFailed'),
    imageUploadMissingUrlMessage: t('error.imageUploadMissingUrl'),
    isStreaming,
    messageSaveFailedMessage: t('error.messageSaveFailed'),
    requestErrorMessage: t('requestError'),
    selectImageTemplateFirstMessage: t('error.selectImageTemplateFirst'),
    selectedChatModelId,
    selectedModelId,
    selectedSourceImages,
    setAIUIMessages,
    setChatError,
    setIsImageWorkflowRunning,
    setIsWaitingFirstResponse,
    setSelectedSourceImages,
    setStreaming,
    unknownErrorMessage: t('unknownError'),
  });

  const {
    handleSend,
    handleUIAction,
  } = useChatViewSending({
    abortRef,
    activeKind,
    activeSessionId,
    addAIUIMessage,
    addMessage,
    appendToLastAssistantMessage,
    attachmentUploadFailedMessage: t('error.attachmentUploadFailed'),
    finalizeAIUIStreaming,
    getAgentKindLabel: (kind) => t(`agentKind.${kind}`),
    handleChatStreamMessage,
    imageQuality,
    imageSize,
    isStreaming,
    modeComingSoonMessage: (kindLabel) => t('error.modeComingSoon', { kind: kindLabel }),
    requestErrorMessage: t('requestError'),
    selectedChatModelId,
    selectedModelId,
    selectedSourceImages,
    setChatError,
    setIsWaitingFirstResponse,
    setStreaming,
    videoInput,
  });

  if (isLoadingSessions) {
    return { status: 'loading' as const };
  }

  if (!activeSession) {
    return {
      status: 'empty' as const,
      onToggleSidebar: sidebarCtx?.toggleSidebar,
    };
  }

  return {
    status: 'ready' as const,
    shellProps: {
      activeSessionId,
      activeKind,
      activeImageTemplateName: imageTemplateResource?.title,
      activeTemplate: activeTemplateSummary,
      activeVideoTemplateName: videoTemplateResource?.title,
      chatError,
      chatToolbarLabels: {
        selectModel: t('toolbar.selectModel'),
        selectTemplate: t('toolbar.selectTemplate'),
        chatModelTooltip: t('toolbar.chatModelTooltip'),
        modelPicker: {
          searchPlaceholder: t('modelPicker.searchPlaceholder'),
          empty: t('modelPicker.empty'),
        },
      },
      conversationPanelMode: isElectron ? 'electron' as const : 'web' as const,
      currentProgress,
      currentTemplateId: activeModeTemplate?.resourceId,
      generatedImagesCount: generatedImages.length,
      hasActiveArtifact: Boolean(activeArtifact),
      hasActiveModeTemplate: Boolean(activeModeTemplate),
      imageQuality,
      imageSize,
      inputEstimate,
      inputEstimateLoading,
      inputKind,
      inputModeDisabled: isStreaming || isSwitchingMode,
      injectValue: promptInject,
      isImageWorkflowRunning,
      isLocked,
      isStreaming,
      isWaitingForUser,
      messages: aiUIMessages,
      modelSupportsVision,
      resetToken: composerResetToken,
      selectedSourceImages,
      streamingMessage,
      templatePromptHost: {
        open: promptDialogOpen,
        onOpenChange: setPromptDialogOpen,
        activeKind,
        videoTemplate: videoTemplateResource,
        imageTemplate: imageTemplateResource,
        initialValues: templateVariables,
        initialSelectedRefs: selectedRefImages,
        onApply: handleTemplatePromptApply,
      },
      templateSheetOpen,
      videoInput,
      videoModels,
      videoModelsLoading: availableModels.length === 0,
      visibleInputMode,
      onChatErrorDismiss: () => setChatError(null),
      onClearSourceImages: () => setSelectedSourceImages([]),
      onGenerateImage: handleGenerateImage,
      onGenerateImageFromInput: handleGenerateImageFromInput,
      onImageQualityChange: setImageQuality,
      onImageSizeChange: setImageSize,
      onInputModeChange: handleInputModeChange,
      onOpenTemplateDrawer: handleOpenTemplateDrawer,
      onOpenTemplateEditor: activeTemplateSummary ? () => setPromptDialogOpen(true) : undefined,
      onRemoveSourceImage: handleRemoveSourceImage,
      onRemoveTemplate: handleRemoveTemplate,
      onReuseTemplate: handleReuseTemplate,
      onSelectSourceImage: toggleSourceImage,
      onSend: handleSend,
      onTemplateSelected: refreshResources,
      onTemplateSheetOpenChange: setTemplateSheetOpen,
      onToggleSidebar: sidebarCtx?.toggleSidebar,
      onToolbarModelChange: handleToolbarModelChange,
      onUIAction: handleUIAction,
      onVideoModelChange: handleVideoModelChange,
    },
  };
}
