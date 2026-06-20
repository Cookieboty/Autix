'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  conversationActions,
  hasImageCapability,
  marketplaceActions,
  useChatStore,
  type AnyResource,
  type ChatAttachment,
} from '@autix/shared-store';
import {
  getChatImageUrls,
  type LocalChatAttachment,
} from '../chat/chat-attachments';
import type { ImageResultItem } from '../chat/MessageBubble';
import { composeTemplatePrompt } from '../chat/utils/composeTemplatePrompt';
import {
  sharedSendController,
  type SendControllerCallbacks,
} from '../chat/utils/sharedSendController';
import { useVideoInputController } from '../video/useVideoInputController';
import type {
  DockMessage,
  ImageGenerationRequest,
  MarketplaceChatDockController,
  MarketplaceChatDockProps,
  SourceImageRef,
  TemplateWithPrompt,
} from './marketplace-chat-dock-types';
import {
  getInitialVideoMode,
  getTemplateConversationKind,
  getTemplateDefaults,
  getTemplateReferenceImages,
  getTemplateVariables,
  getVideoContextAttachments,
  uniqueRefs,
  uploadDockAttachments,
} from './marketplace-chat-dock-utils';

export function useMarketplaceChatDockController({
  template,
  resourceType,
  onClose,
}: MarketplaceChatDockProps): MarketplaceChatDockController | null {
  const t = useTranslations('marketplace.chatDock');
  const [messages, setMessages] = useState<DockMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [selectedSourceImages, setSelectedSourceImages] = useState<SourceImageRef[]>([]);
  const [injectToken, setInjectToken] = useState(0);
  const videoInput = useVideoInputController({
    appendAdditionalFirstLastWhenFull: false,
    pasteEnabled: resourceType === 'VIDEO_TEMPLATE',
  });
  const [imageSize, setImageSize] = useState('auto');
  const [imageQuality, setImageQuality] = useState('standard');
  const [imageCount, setImageCount] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    createSession,
    deleteSession,
    activeSessionId,
    setActiveSession,
    availableModels,
    selectedChatModelId,
    fetchAvailableModels,
  } = useChatStore();

  const tpl = template as (AnyResource & TemplateWithPrompt) | null;
  const isImageTemplate = resourceType === 'IMAGE_TEMPLATE';
  const isVideoTemplate = resourceType === 'VIDEO_TEMPLATE';
  const variables = useMemo(() => getTemplateVariables(tpl), [tpl]);
  const referenceImages = useMemo(
    () => getTemplateReferenceImages(tpl, isVideoTemplate),
    [isVideoTemplate, tpl],
  );

  useEffect(() => {
    if (!template) return;
    const defaults = getTemplateDefaults(variables);
    const nextVideoMode = getInitialVideoMode(tpl);
    const initialRefs: string[] = [];
    setVarValues(defaults);
    setSelectedRefs(initialRefs);
    setSelectedSourceImages([]);
    setMessages([]);
    setSessionId(null);
    setError(null);
    setIsStreaming(false);
    if (isVideoTemplate) {
      videoInput.resetInputsForTemplateMode(nextVideoMode, initialRefs);
      videoInput.setRatio(tpl?.defaultParams?.ratio ?? 'adaptive');
      videoInput.setDuration(tpl?.durationSec ?? 5);
      videoInput.setModel(tpl?.modelHint ?? '');
      setPromptDialogOpen(true);
    } else {
      videoInput.clearInputs();
      setPromptDialogOpen(false);
    }
    setInjectToken((token) => token + 1);
  }, [template?.id]);

  useEffect(() => {
    if (isImageTemplate && availableModels.length === 0) {
      void fetchAvailableModels();
    }
  }, [availableModels.length, fetchAvailableModels, isImageTemplate]);

  const resolvedPrompt = useMemo(
    () => tpl ? composeTemplatePrompt(tpl.prompt ?? '', varValues) : '',
    [tpl, varValues],
  );

  const injectValue = useMemo(
    () => {
      if (!template) return undefined;
      const images = isImageTemplate ? selectedRefs : undefined;
      return {
        content: resolvedPrompt,
        images,
        token: injectToken,
      };
    },
    [injectToken, isImageTemplate, resolvedPrompt, selectedRefs, template],
  );

  const reapplyTemplate = useCallback(() => {
    setInjectToken((token) => token + 1);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const pushMessage = useCallback((message: DockMessage) => {
    setMessages((prev) => [...prev, { ...message, timestamp: message.timestamp ?? new Date() }]);
    requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);

  const finishLastAssistantMessage = useCallback(() => {
    setMessages((prev) =>
      prev.map((message, index) =>
        index === prev.length - 1 && message.role === 'assistant'
          ? { ...message, isStreaming: false }
          : message,
      ),
    );
  }, []);

  const replaceAssistantProgress = useCallback(
    (messageType: 'image_generating' | 'image_editing' | 'image_result', payload: unknown) => {
      const taskId =
        payload && typeof payload === 'object' && 'taskId' in payload
          ? (payload as { taskId?: unknown }).taskId
          : undefined;

      setMessages((prev) => {
        const withoutSameProgress = prev.filter((message) => {
          if (message.role !== 'assistant') return true;
          if (
            message.messageType !== 'image_generating' &&
            message.messageType !== 'image_editing'
          ) {
            return true;
          }
          if (!taskId) return false;
          const existingTaskId =
            message.payload &&
            typeof message.payload === 'object' &&
            'taskId' in message.payload
              ? (message.payload as { taskId?: unknown }).taskId
              : undefined;
          return existingTaskId !== taskId;
        });

        return [
          ...withoutSameProgress,
          {
            role: 'assistant',
            content: '',
            messageType,
            payload,
            isStreaming: messageType !== 'image_result',
            timestamp: new Date(),
          },
        ];
      });
      requestAnimationFrame(scrollToBottom);
    },
    [scrollToBottom],
  );

  const ensureTemplateSession = useCallback(async (): Promise<string | null> => {
    if (!template) return null;
    if (sessionId) return sessionId;

    const previousActiveSessionId = activeSessionId;
    const kind = getTemplateConversationKind(resourceType);

    let convId: string;
    try {
      convId = await createSession(template.title, { kind });
      setSessionId(convId);
    } catch (err: any) {
      setError(err.message ?? t('createSessionFailed'));
      return null;
    }

    try {
      await marketplaceActions.attachConversationResource(
        convId,
        resourceType,
        template.id,
      );
    } catch (err: any) {
      try {
        await deleteSession(convId);
        if (previousActiveSessionId) {
          await setActiveSession(previousActiveSessionId);
        }
      } catch {
        // Best-effort rollback; the attach error below is the user-facing failure.
      }
      setSessionId(null);
      setError(err.message ?? t('attachTemplateFailed'));
      return null;
    }

    return convId;
  }, [
    activeSessionId,
    createSession,
    deleteSession,
    resourceType,
    sessionId,
    setActiveSession,
    template,
  ]);

  const resolveImageModelId = useCallback(async () => {
    const current = useChatStore.getState();
    let models = current.availableModels;
    if (models.length === 0) {
      await fetchAvailableModels();
      models = useChatStore.getState().availableModels;
    }

    const selected = models.find((model) => model.id === current.selectedModelId);
    if (selected && hasImageCapability(selected.capabilities ?? [])) {
      return selected.id;
    }

    return models.find((model) => hasImageCapability(model.capabilities ?? []))?.id ?? null;
  }, [fetchAvailableModels]);

  const handleSend = useCallback(
    async (content: string, attachments?: LocalChatAttachment[]) => {
      if (!template || isStreaming) return;
      setError(null);

      const convId = await ensureTemplateSession();
      if (!convId) return;

      abortRef.current = new AbortController();
      const videoContextAttachments = isVideoTemplate
        ? getVideoContextAttachments({
          mode: videoInput.mode,
          materials: videoInput.materials,
          frames: videoInput.frames,
        })
        : [];
      const mergedAttachments = [
        ...(attachments ?? []),
        ...videoContextAttachments,
      ];

      const callbacks: SendControllerCallbacks = {
        onUserMessage: (text, metadata) => {
          pushMessage({ role: 'user', content: text, metadata });
        },
        onAssistantPlaceholder: () => {
          pushMessage({ role: 'assistant', content: '', isStreaming: true });
        },
        onStreamStart: () => {
          setIsStreaming(true);
        },
        onMarkdown: (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk,
                isStreaming: true,
              };
            }
            return updated;
          });
          scrollToBottom();
        },
        onUI: () => {},
        onMeta: () => {},
        onProgress: () => {},
        onLog: () => {},
        onImageResult: () => {},
        onArtifactCreated: () => {},
        onDone: () => {
          setIsStreaming(false);
          finishLastAssistantMessage();
        },
        onError: (errMsg) => {
          setError(errMsg);
          setIsStreaming(false);
          abortRef.current?.abort();
        },
        onStreamEnd: () => {
          setIsStreaming(false);
          finishLastAssistantMessage();
        },
      };

      await sharedSendController(
        {
          conversationId: convId,
          content,
          attachments: mergedAttachments.length > 0 ? mergedAttachments : undefined,
          modelId: isVideoTemplate ? videoInput.model || undefined : undefined,
          signal: abortRef.current.signal,
        },
        callbacks,
        {
          attachmentUploadFailed: t('attachmentUploadFailed'),
          unknownError: t('unknownError'),
          sendFailed: t('sendFailed'),
        },
      );
    },
    [template, isStreaming, ensureTemplateSession, isVideoTemplate, videoInput.mode, videoInput.materials, videoInput.frames, videoInput.model, pushMessage, scrollToBottom, finishLastAssistantMessage, t],
  );

  const handleGenerateImage = useCallback(
    async (payload?: ImageGenerationRequest) => {
      if (!template || !isImageTemplate || isStreaming) return;
      setError(null);

      const convId = await ensureTemplateSession();
      if (!convId) return;

      const modelId = await resolveImageModelId();
      if (!modelId) {
        setError(t('configureImageModelFirst'));
        return;
      }

      const sourceImages = payload?.sourceImages ?? selectedSourceImages;
      const instruction = payload?.editInstruction;
      const referenceImages = uniqueRefs([
        ...selectedRefs.map((url) => ({ url })),
        ...(payload?.inputImages ?? []).map((url) => ({ url })),
      ]);

      if (instruction || payload?.inputImages?.length) {
        const userMetadata = payload?.inputImages?.length
          ? { images: payload.inputImages }
          : undefined;

        try {
          await conversationActions.appendConversationMessage(convId, {
            role: 'USER',
            content: instruction ?? '',
            metadata: userMetadata,
          });
        } catch (err: any) {
          setError(err.message ?? t('messageSaveFailed'));
          return;
        }

        pushMessage({
          role: 'user',
          content: instruction ?? '',
          metadata: userMetadata,
        });
      }

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        await conversationActions.streamConversationImageGeneration(convId, {
          body: {
            model: modelId,
            chatModelId: selectedChatModelId ?? undefined,
            n: imageCount,
            templateId: template.id,
            variables: varValues,
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
          requestErrorMessage: t('requestFailed'),
          onMessage(msg) {
            if (msg.messageType === 'image_generating' || msg.messageType === 'image_editing') {
              replaceAssistantProgress(msg.messageType, msg.payload);
            } else if (msg.messageType === 'image_result') {
              replaceAssistantProgress(msg.messageType, msg.payload);
              setSelectedSourceImages([]);
            } else if (msg.messageType === 'done') {
              setIsStreaming(false);
            } else if (msg.messageType === 'error') {
              const errPayload = msg.payload as { error?: string } | null;
              setError(errPayload?.error || t('imageGenerationFailed'));
              setIsStreaming(false);
              abortRef.current?.abort();
            }
          },
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? t('imageGenerationFailed'));
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [
      ensureTemplateSession,
      isImageTemplate,
      isStreaming,
      replaceAssistantProgress,
      resolveImageModelId,
      imageCount,
      imageQuality,
      imageSize,
      selectedChatModelId,
      selectedRefs,
      selectedSourceImages,
      template,
      t,
      varValues,
      pushMessage,
    ],
  );

  const handleGenerateImageFromInput = useCallback(
    async (instruction?: string, attachments?: LocalChatAttachment[]) => {
      let uploadedAttachments: ChatAttachment[] = [];
      try {
        uploadedAttachments = await uploadDockAttachments(
          attachments?.filter((attachment) => attachment.kind === 'image'),
        );
      } catch (err: any) {
        setError(err.message ?? t('attachmentUploadFailed'));
        return;
      }

      const inputImages = getChatImageUrls(uploadedAttachments);
      await handleGenerateImage({
        ...(selectedSourceImages.length > 0
          ? { editInstruction: instruction, sourceImages: selectedSourceImages }
          : { promptOverride: instruction }),
        inputImages: inputImages.length > 0 ? inputImages : undefined,
      });
    },
    [handleGenerateImage, selectedSourceImages, t],
  );

  const toggleSourceImage = useCallback((image: ImageResultItem) => {
    setSelectedSourceImages((prev) => {
      const exists = prev.some(
        (item) =>
          item.url === image.url &&
          item.generationId === image.generationId &&
          item.index === image.index,
      );
      if (exists) {
        return prev.filter(
          (item) =>
            !(
              item.url === image.url &&
              item.generationId === image.generationId &&
              item.index === image.index
            ),
        );
      }
      return [
        ...prev,
        {
          url: image.url,
          prompt: image.prompt,
          generationId: image.generationId,
          index: image.index,
        },
      ];
    });
  }, []);

  const removeSourceImage = useCallback((index: number) => {
    setSelectedSourceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearSourceImages = useCallback(() => {
    setSelectedSourceImages([]);
  }, []);

  const handleTemplateApply = useCallback(
    (_composed: string, values: Record<string, string>, refs: string[]) => {
      setVarValues(values);
      setSelectedRefs(refs);
      if (isVideoTemplate) {
        videoInput.applyRefs(refs);
      }
      setInjectToken((token) => token + 1);
      setPromptDialogOpen(false);
    },
    [isVideoTemplate, videoInput],
  );

  if (!template || !tpl) return null;

  const hasTemplateEditor = variables.length > 0 || referenceImages.length > 0;

  return {
    template,
    tpl,
    resourceType,
    onClose,
    messages,
    messagesEndRef,
    isStreaming,
    error,
    sessionId,
    promptDialogOpen,
    setPromptDialogOpen,
    varValues,
    selectedRefs,
    selectedSourceImages,
    injectValue,
    imageSize,
    setImageSize,
    imageQuality,
    setImageQuality,
    imageCount,
    setImageCount,
    variables,
    referenceImages,
    hasTemplateEditor,
    isImageTemplate,
    isVideoTemplate,
    videoInput,
    handleSend,
    handleGenerateImage,
    handleGenerateImageFromInput,
    toggleSourceImage,
    removeSourceImage,
    clearSourceImages,
    reapplyTemplate,
    handleTemplateApply,
  };
}
