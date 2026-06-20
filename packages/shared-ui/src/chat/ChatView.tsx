'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../navigation';
import { useChatStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useResourcePanelStore } from '@autix/shared-store';
import {
  conversationActions,
  marketplaceActions,
} from '@autix/shared-store';
import {
  isVideoModel,
  type AgentKind,
  type ChatAttachment,
} from '@autix/shared-store';
import type { InputMode } from './InputModeSwitch';
import { getChatImageUrls, type LocalChatAttachment } from './chat-attachments';
import { mapSessionMessagesToAIUIMessages } from './chat-history-mapper';
import type { SourceImageRef } from './chat-source-images';
import { uploadChatAttachments, uploadChatImages } from './chat-upload-actions';
import { useIsElectron } from '../hooks/useIsElectron';
import { useOptionalSidebar } from '../ui/sidebar';
import { normalizeImageResultItems } from './MessageBubble';
import { composeTemplatePrompt } from './utils/composeTemplatePrompt';
import { useVideoInputController } from '../video/useVideoInputController';
import { resolveActiveAgentKind, toVisibleInputMode } from './chat-mode';
import { useChatInputEstimate } from './useChatInputEstimate';
import { useChatStreamMessageHandler } from './useChatStreamMessageHandler';
import { useConversationResources } from './useConversationResources';
import { useImageModelDefaults } from './useImageModelDefaults';
import { useTemplatePromptState } from './useTemplatePromptState';
import { ChatEmptySessionState } from './ChatEmptySessionState';
import { ChatLoadingState } from './ChatLoadingState';
import { ChatViewShell } from './ChatViewShell';
import type {
  StreamMessage,
  UIAction,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';

interface ChatViewProps {
  /** 如果由 URL 参数提供，则直接激活该会话 */
  sessionId?: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
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
  const [imageSize, setImageSize] = useState('auto');
  const [imageQuality, setImageQuality] = useState('standard');
  const [imageCount, setImageCount] = useState(1);
  const [selectedSourceImages, setSelectedSourceImages] = useState<SourceImageRef[]>([]);
  const [isImageWorkflowRunning, setIsImageWorkflowRunning] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [composerResetToken, setComposerResetToken] = useState(0);
  const [inputModeOverride, setInputModeOverride] = useState<InputMode | null>(null);
  const imageWorkflowRunningRef = useRef(false);

  const videoInput = useVideoInputController({
    appendAdditionalFirstLastWhenFull: true,
  });
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);


  const activeSession = getActiveSession();
  const {
    activeAgent,
    activeImageTemplate,
    activeVideoTemplate,
    imageTemplateResource,
    videoTemplateResource,
    refreshResources,
    detachActiveTemplates,
  } = useConversationResources(activeSessionId);
  const isLocked = (activeSession?.messages?.length ?? 0) > 0;
  const selectedModel = availableModels.find((m) => m.id === selectedModelId);
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
    if (!value) return videoModels[0] ?? null;
    return (
      videoModels.find(
        (model) =>
          model.id === value ||
          model.model === value ||
          model.name === value,
      ) ?? videoModels[0] ?? null
    );
  }, [videoInput.model, videoModels, videoTemplateResource?.modelHint]);
  const modelSupportsVision = selectedModel?.capabilities?.includes('vision') ?? false;
  const generatedImages = aiUIMessages.flatMap((message: any) =>
    message.messageType === 'image_result'
      ? normalizeImageResultItems(
        message.payload?.images,
        message.payload?.prompt,
        message.payload?.generationId,
      )
      : [],
  );
  /**
   * Sticky image-mode rule:
   * Once a conversation has produced (or is producing) image results, treat it as
   * an image-mode conversation regardless of whether the IMAGE_TEMPLATE resource is
   * still attached. Removing one template should let the user pick another, not
   * silently fall back to chat mode.
   */
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
    imageCount,
    imageQuality,
    imageSize,
    selectedImageModel,
    selectedSourceImageCount: selectedSourceImages.length,
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
    setResourcePanelConversationId(activeSessionId ?? undefined);
  }, [activeSessionId, setResourcePanelConversationId]);

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
    } catch (err: any) {
      setInputModeOverride(
        previousKind === 'image' || previousKind === 'video'
          ? previousKind
          : 'chat',
      );
      setSessionKind(activeSessionId, previousKind as any);
      setChatError(err?.message ?? t('error.switchModeFailed'));
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

  const handleChatStreamMessage = useChatStreamMessageHandler({
    abortRef,
    addAIUIMessage,
    appendToLastAssistantMessage,
    clearProgress,
    finalizeAIUIStreaming,
    loadArtifactById,
    setChatError,
    setIsWaitingFirstResponse,
    setProgress,
    setSelectedSourceImages,
    setStage,
    setStreaming,
    unknownErrorMessage: t('unknownError'),
    updateStreamingMessage,
  });

  useEffect(() => {
    if (searchParams.get('resourcePanel') !== '1') return;
    openResourcePanel({
      conversationId: activeSessionId ?? undefined,
      type: (searchParams.get('type') as any) ?? undefined,
      resourceId: searchParams.get('resourceId') ?? undefined,
      source: 'chat',
    });
  }, [activeSessionId, openResourcePanel, searchParams]);

  // 会话切换时加载产物
  useEffect(() => {
    if (!activeSessionId) {
      clearArtifact();
      return;
    }

    loadArtifactByConversation(activeSessionId)
      .catch((error) => {
        console.error('Failed to load artifact:', error);
      });
  }, [activeSessionId, loadArtifactByConversation, clearArtifact]);

  useEffect(() => {
    const init = async () => {
      let state = useChatStore.getState();

      if (sessionId) {
        let exists = state.sessions.find((s) => s.id === sessionId);
        if (!exists) {
          await fetchSessions();
          state = useChatStore.getState();
          exists = state.sessions.find((s) => s.id === sessionId);
        }
        if (exists) {
          await setActiveSession(sessionId);
          return;
        }
      }

      if (!state.activeSessionId) {
        if (state.sessions.length === 0) {
          await fetchSessions();
          state = useChatStore.getState();
        }
        if (state.sessions.length > 0) {
          const first = state.sessions[0];
          await setActiveSession(first.id);
          router.replace(`/c/${first.id}`);
        } else {
          const id = await createSession(t('newConversation'));
          router.replace(`/c/${id}`);
        }
      }
    };
    init();
  }, [sessionId]);

  useEffect(() => {
    if (availableModels.length === 0) {
      void fetchAvailableModels();
    }
  }, [availableModels.length, fetchAvailableModels]);

  // 同步历史消息到 AI UI Store
  useEffect(() => {
    // 如果正在流式响应，不要覆盖消息
    if (isStreaming) {
      return;
    }

    if (!activeSession?.messages || activeSession.messages.length === 0) {
      setAIUIMessages([]);
      return;
    }

    setAIUIMessages(mapSessionMessagesToAIUIMessages(activeSession.messages));
  }, [activeSession?.id, activeSession?.messages.length]);

  useEffect(() => {
    // 只在会话存在且有消息时滚动
    if (!activeSession?.id || aiUIMessages.length === 0) {
      return;
    }
  }, [activeSession?.id, aiUIMessages.length]);

  const handleGenerateImage = async (payload?: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: SourceImageRef[];
    inputImages?: string[];
  }) => {
    if (
      !activeSessionId ||
      isStreaming ||
      imageWorkflowRunningRef.current
    ) {
      return;
    }
    if (!activeImageTemplate?.resourceId) {
      setChatError(t('error.selectImageTemplateFirst'));
      return;
    }
    const sourceImages = payload?.sourceImages ?? selectedSourceImages;
    const instruction = payload?.editInstruction;

    setStreaming(true);
    setIsImageWorkflowRunning(true);
    imageWorkflowRunningRef.current = true;
    setIsWaitingFirstResponse(true);
    setChatError(null);
    abortRef.current = new AbortController();

    let uploadedInputImages: string[] = [];
    try {
      uploadedInputImages = await uploadChatImages(payload?.inputImages, {
        missingPublicUrlMessage: t('error.imageUploadMissingUrl'),
      });
    } catch (err: any) {
      setChatError(err.message ?? t('error.imageUploadFailed'));
      setStreaming(false);
      setIsImageWorkflowRunning(false);
      imageWorkflowRunningRef.current = false;
      setIsWaitingFirstResponse(false);
      return;
    }
    const referenceImages = uploadedInputImages.map((url) => ({ url }));

    if (instruction || uploadedInputImages.length > 0) {
      const userMetadata = uploadedInputImages.length > 0 ? { images: uploadedInputImages } : undefined;
      try {
        await conversationActions.appendConversationMessage(activeSessionId, {
          role: 'USER',
          content: instruction ?? '',
          metadata: userMetadata,
        });
      } catch (err: any) {
        setChatError(err.message ?? t('error.messageSaveFailed'));
        setStreaming(false);
        setIsImageWorkflowRunning(false);
        imageWorkflowRunningRef.current = false;
        setIsWaitingFirstResponse(false);
        return;
      }
      addMessage(activeSessionId, {
        role: 'user',
        content: instruction ?? '',
        timestamp: new Date().toISOString(),
        metadata: userMetadata,
      });
      addAIUIMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: instruction ?? '',
        payload: userMetadata,
        timestamp: new Date(),
      } as any);
    }

    try {
      await conversationActions.streamConversationImageGeneration(activeSessionId, {
        body: {
          model: selectedModelId ?? undefined,
          chatModelId: selectedChatModelId ?? undefined,
          n: imageCount,
          templateId: activeImageTemplate?.resourceId,
          promptOverride: payload?.promptOverride,
          sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          editInstruction: instruction,
          settings: {
            size: imageSize,
            quality: imageQuality,
          },
        },
        signal: abortRef.current.signal,
        requestErrorMessage: t('requestError'),
        onMessage(msg) {
          setIsWaitingFirstResponse(false);

          if (msg.messageType === 'image_generating' || msg.messageType === 'image_editing') {
            const taskId = (msg.payload as any)?.taskId;
            const currentMessages = useAIUIStore.getState().messages;
            const hasProgress = currentMessages.some(
              (item: any) =>
                (item.messageType === 'image_generating' || item.messageType === 'image_editing') &&
                item.payload?.taskId === taskId,
            );
            if (!hasProgress) {
              addAIUIMessage({
                id: `${msg.messageType}-${taskId ?? Date.now()}`,
                role: 'assistant',
                messageType: msg.messageType,
                content: '',
                payload: msg.payload,
                timestamp: new Date(),
              } as any);
            }
          }

          if (msg.messageType === 'image_result') {
            const taskId = (msg.payload as any)?.taskId;
            const currentMessages = useAIUIStore.getState().messages;
            setAIUIMessages([
              ...currentMessages.filter(
                (item: any) =>
                  !(
                    (item.messageType === 'image_generating' || item.messageType === 'image_editing') &&
                    item.payload?.taskId === taskId
                  ),
              ),
              {
                id: `${msg.messageType}-${taskId ?? Date.now()}`,
                role: 'assistant',
                messageType: msg.messageType,
                content: '',
                payload: msg.payload,
                timestamp: new Date(),
              } as any,
            ]);
            setSelectedSourceImages([]);
          }

          if (msg.messageType === 'done') {
            setStreaming(false);
            setIsImageWorkflowRunning(false);
            imageWorkflowRunningRef.current = false;
            finalizeAIUIStreaming();
          }

          if (msg.messageType === 'error') {
            const errPayload = msg.payload as { error?: string } | null;
            setChatError(errPayload?.error || t('unknownError'));
            setStreaming(false);
            setIsImageWorkflowRunning(false);
            imageWorkflowRunningRef.current = false;
            finalizeAIUIStreaming();
          }
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') setChatError(err.message ?? t('requestError'));
      setStreaming(false);
      setIsImageWorkflowRunning(false);
      imageWorkflowRunningRef.current = false;
      setIsWaitingFirstResponse(false);
      finalizeAIUIStreaming();
    }
  };

  const handleSend = async (content: string, attachments?: LocalChatAttachment[]) => {
    if (!activeSessionId) return;
    setChatError(null);

    if (activeKind !== 'chat' && activeKind !== 'image' && activeKind !== 'video') {
      setChatError(t('error.modeComingSoon', { kind: t(`agentKind.${activeKind}`) }));
      return;
    }

    if (isStreaming) {
      console.warn('[ChatView] Request already in progress, ignoring duplicate request');
      return;
    }

    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    let uploadedAttachments: ChatAttachment[] = [];
    try {
      uploadedAttachments = await uploadChatAttachments(attachments);
    } catch (err: any) {
      setChatError(err.message ?? t('error.attachmentUploadFailed'));
      setStreaming(false);
      setIsWaitingFirstResponse(false);
      return;
    }
    const uploadedImages = getChatImageUrls(uploadedAttachments);
    const userMetadata =
      uploadedImages.length > 0 || uploadedAttachments.length > 0
        ? {
          ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
        }
        : undefined;

    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata: userMetadata,
    });

    addAIUIMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      payload: userMetadata,
      timestamp: new Date(),
    } as any);

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    try {
      await conversationActions.streamConversationChat(activeSessionId, {
        body: {
          message: content,
          modelId: activeKind === 'video' ? (videoInput.model || selectedModelId || undefined) : (selectedModelId ?? undefined),
          ...(uploadedImages.length ? { images: uploadedImages } : {}),
          ...(uploadedAttachments.length ? { attachments: uploadedAttachments } : {}),
          sourceImages: selectedSourceImages.length > 0 ? selectedSourceImages : undefined,
        },
        signal: abortRef.current.signal,

        onmessage(event) {
          setIsWaitingFirstResponse(false);

          try {
            handleChatStreamMessage(activeSessionId, JSON.parse(event.data) as StreamMessage, {
              includeImageMessages: true,
            });
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        },

        onerror(err) {
          console.error('SSE connection error:', err);
          setStreaming(false);
          finalizeAIUIStreaming();
          // 抛出异常来停止重试
          throw err;
        },

        onclose() {
          console.log('SSE connection closed');
        },

        openWhenHidden: false,

        async onopen(response) {
          if (response.ok) {
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, `\n\n*[${t('requestError')}]*`);
      }
      setStreaming(false);
      finalizeAIUIStreaming();
    }
  };

  const handleGenerateImageFromInput = async (
    instruction?: string,
    attachments?: LocalChatAttachment[],
  ) => {
    let uploadedAttachments: ChatAttachment[] = [];
    try {
      uploadedAttachments = await uploadChatAttachments(
        attachments?.filter((attachment) => attachment.kind === 'image'),
      );
    } catch (err: any) {
      setChatError(err.message ?? t('error.attachmentUploadFailed'));
      return;
    }

    const inputImages = getChatImageUrls(uploadedAttachments);
    return handleGenerateImage({
      ...(selectedSourceImages.length > 0
        ? { editInstruction: instruction, sourceImages: selectedSourceImages }
        : { promptOverride: instruction }),
      inputImages: inputImages.length > 0 ? inputImages : undefined,
    });
  };

  const handleUIAction = async (componentId: string, action: string, data: Record<string, unknown>) => {
    if (!activeSessionId) return;

    const uiAction: UIAction = {
      componentId,
      action: action as 'submit' | 'cancel' | 'custom',
      data,
      timestamp: new Date().toISOString(),
    };

    // UI 操作不应该生成用户消息，直接发送到后端
    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    try {
      await conversationActions.streamConversationChat(activeSessionId, {
        body: {
          message: uiAction,
          modelId: selectedModelId ?? undefined,
        },
        signal: abortRef.current.signal,

        onmessage(event) {
          setIsWaitingFirstResponse(false);

          try {
            handleChatStreamMessage(activeSessionId, JSON.parse(event.data) as StreamMessage, {
              errorLogLabel: 'Server returned an error (UIAction)',
              clearWaitingOnError: true,
            });
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        },

        onerror(err) {
          console.error('SSE connection error:', err);
          setStreaming(false);
          setIsWaitingFirstResponse(false);
          finalizeAIUIStreaming();
          // 抛出异常来停止重试
          throw err;
        },

        onclose() {
          console.log('SSE connection closed');
        },

        openWhenHidden: false,

        async onopen(response) {
          if (response.ok) {
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, `\n\n*[${t('requestError')}]*`);
      }
      setStreaming(false);
      setIsWaitingFirstResponse(false);
      finalizeAIUIStreaming();
    }
  };

  const activeTemplateSummary =
    (inputKind === 'image' || inputKind === 'video') && activeModeTemplateResource
      ? {
        id: activeModeTemplate?.resourceId ?? '',
        title: activeModeTemplateResource?.title ?? '',
        coverImage: inputKind === 'image' ? imageTemplateResource?.coverImage : undefined,
        variableCount: (activeModeTemplateResource?.variables ?? []).length,
      }
      : undefined;

  const handleRemoveSourceImage = (index: number) => {
    setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index));
  };

  const handleOpenTemplateDrawer = () => {
    setTemplateSheetOpen(true);
    if (sidebarCtx?.open) sidebarCtx.setOpen(false);
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

  if (isLoadingSessions) {
    return <ChatLoadingState />;
  }

  if (!activeSession) {
    return <ChatEmptySessionState onToggleSidebar={sidebarCtx?.toggleSidebar} />;
  }

  return (
    <ChatViewShell
      activeSessionId={activeSessionId}
      activeKind={activeKind}
      activeImageTemplateName={imageTemplateResource?.title}
      activeTemplate={activeTemplateSummary}
      activeVideoTemplateName={videoTemplateResource?.title}
      availableModelCount={availableModels.length}
      chatError={chatError}
      chatToolbarLabels={{
        selectModel: t('toolbar.selectModel'),
        selectTemplate: t('toolbar.selectTemplate'),
        chatModelTooltip: t('toolbar.chatModelTooltip'),
        noModelsGoConfig: t('noModelsGoConfig'),
        modelPicker: {
          searchPlaceholder: t('modelPicker.searchPlaceholder'),
          empty: t('modelPicker.empty'),
        },
      }}
      conversationPanelMode={isElectron ? 'electron' : 'web'}
      currentProgress={currentProgress}
      currentTemplateId={activeModeTemplate?.resourceId}
      generatedImagesCount={generatedImages.length}
      hasActiveArtifact={Boolean(activeArtifact)}
      hasActiveModeTemplate={Boolean(activeModeTemplate)}
      imageCount={imageCount}
      imageQuality={imageQuality}
      imageSize={imageSize}
      inputEstimate={inputEstimate}
      inputEstimateLoading={inputEstimateLoading}
      inputKind={inputKind}
      inputModeDisabled={isStreaming || isSwitchingMode}
      injectValue={promptInject}
      isImageWorkflowRunning={isImageWorkflowRunning}
      isLocked={isLocked}
      isStreaming={isStreaming}
      isWaitingForUser={isWaitingForUser}
      messages={aiUIMessages}
      modelSupportsVision={modelSupportsVision}
      resetToken={composerResetToken}
      selectedSourceImages={selectedSourceImages}
      streamingMessage={streamingMessage}
      templatePromptHost={{
        open: promptDialogOpen,
        onOpenChange: setPromptDialogOpen,
        activeKind,
        videoTemplate: videoTemplateResource,
        imageTemplate: imageTemplateResource,
        initialValues: templateVariables,
        initialSelectedRefs: selectedRefImages,
        onApply: handleTemplatePromptApply,
      }}
      templateSheetOpen={templateSheetOpen}
      videoInput={videoInput}
      videoModels={videoModels}
      videoModelsLoading={availableModels.length === 0}
      visibleInputMode={visibleInputMode}
      onChatErrorDismiss={() => setChatError(null)}
      onClearSourceImages={() => setSelectedSourceImages([])}
      onGenerateImage={handleGenerateImage}
      onGenerateImageFromInput={handleGenerateImageFromInput}
      onImageCountChange={setImageCount}
      onImageQualityChange={setImageQuality}
      onImageSizeChange={setImageSize}
      onInputModeChange={handleInputModeChange}
      onOpenTemplateDrawer={handleOpenTemplateDrawer}
      onOpenTemplateEditor={activeTemplateSummary ? () => setPromptDialogOpen(true) : undefined}
      onRemoveSourceImage={handleRemoveSourceImage}
      onRemoveTemplate={handleRemoveTemplate}
      onReuseTemplate={handleReuseTemplate}
      onSelectSourceImage={toggleSourceImage}
      onSend={handleSend}
      onTemplateSelected={refreshResources}
      onTemplateSheetOpenChange={setTemplateSheetOpen}
      onToggleSidebar={sidebarCtx?.toggleSidebar}
      onToolbarModelChange={handleToolbarModelChange}
      onUIAction={handleUIAction}
      onVideoModelChange={handleVideoModelChange}
    />
  );
}
