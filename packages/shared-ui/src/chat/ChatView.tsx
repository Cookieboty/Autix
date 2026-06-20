'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../navigation';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useChatStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useResourcePanelStore } from '@autix/shared-store';
import { PanelLeftIcon, Laugh, AlertCircle, X } from 'lucide-react';
import {
  conversationActions,
  marketplaceActions,
  uploadBase64ImageToStorage,
  uploadFileToStorage,
  type VideoTemplate,
} from '@autix/shared-store';
import {
  isVideoModel,
  listAvailableModels,
  type AgentKind,
  type ChatAttachment,
} from '@autix/shared-store';
import { MessageBubble } from './MessageBubble';
import { ChatPromptInput } from './ChatPromptInput';
import { InputModeSwitch, type InputMode } from './InputModeSwitch';
import { getChatImageUrls, normalizeChatAttachments, type LocalChatAttachment } from './chat-attachments';
import { ThinkingIndicator } from './ThinkingIndicator';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '../ai-elements/conversation';
import { AIUIRenderer } from '../ai-ui';
import { ArtifactPanel } from '../artifact/ArtifactPanel';
import { ResourcePanel } from '../marketplace/ResourcePanel';
import { ChatToolbar } from './ChatToolbar';
import { ModelConfigTip } from './ModelConfigTip';
import { useIsElectron } from '../hooks/useIsElectron';
import { useOptionalSidebar } from '../ui/sidebar';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '../ui/empty';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { normalizeImageResultItems, type ImageResultItem } from './MessageBubble';
import { ConversationImagesPanel } from './ConversationImagesPanel';
import { composeTemplatePrompt } from './utils/composeTemplatePrompt';
import { TemplatePickerDrawer } from './TemplatePickerDrawer';
import { TemplatePromptDialog } from './TemplatePromptDialog';
import { VideoInputArea } from '../video/VideoInputArea';
import { VideoToolbar } from '../video/VideoToolbar';
import { useVideoInputController } from '../video/useVideoInputController';
import { ErrorMessageBody, splitErrorMessage } from './chat-error-message';
import { resolveActiveAgentKind, toVisibleInputMode } from './chat-mode';
import { useChatInputEstimate } from './useChatInputEstimate';
import type {
  ArtifactCreatedPayload,
  LogPayload,
  MarkdownPayload,
  MetaPayload,
  ProgressPayload,
  ResourceType,
  StreamMessage,
  UIAction,
  UIPayload,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';

interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

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
  const tc = useTranslations('common');
  const {
    sessions,
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
    reset: resetAIUI,
    clearMessages,
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
  const [lastAssistantUIResponse, setLastAssistantUIResponse] = useState<any>(null);
  const [isWaitingFirstResponse, setIsWaitingFirstResponse] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeResources, setActiveResources] = useState<any[]>([]);
  const [imageModels, setImageModels] = useState<any[]>([]);
  const [imageSize, setImageSize] = useState('auto');
  const [imageQuality, setImageQuality] = useState('standard');
  const [imageCount, setImageCount] = useState(1);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [selectedSourceImages, setSelectedSourceImages] = useState<SourceImageRef[]>([]);
  const [isImageWorkflowRunning, setIsImageWorkflowRunning] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [selectedRefImages, setSelectedRefImages] = useState<string[]>([]);
  const [promptInject, setPromptInject] = useState<{ content: string; images?: string[]; token: number } | null>(null);
  const [composerResetToken, setComposerResetToken] = useState(0);
  const [inputModeOverride, setInputModeOverride] = useState<InputMode | null>(null);
  const imageWorkflowRunningRef = useRef(false);

  const videoInput = useVideoInputController({
    appendAdditionalFirstLastWhenFull: true,
  });
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);


  const activeSession = getActiveSession();
  const activeAgentResource = activeResources.find((item) => item.resourceType === 'AGENT');
  const activeAgent = activeAgentResource?.resource as { id?: string; title?: string; kind?: AgentKind } | undefined;
  const isLocked = (activeSession?.messages?.length ?? 0) > 0;
  const activeImageTemplate = activeResources.find((item) => item.resourceType === 'IMAGE_TEMPLATE');
  const activeVideoTemplate = activeResources.find((item) => item.resourceType === 'VIDEO_TEMPLATE');
  const imageTemplateResource = activeImageTemplate?.resource as any | undefined;
  const videoTemplateResource = activeVideoTemplate?.resource as VideoTemplate | undefined;
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

  const clearComposerContent = () => {
    setPromptInject(null);
    setSelectedRefImages([]);
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

  const detachActiveTemplates = async (conversationId: string) => {
    const templates = [
      activeImageTemplate ? { type: 'IMAGE_TEMPLATE', id: activeImageTemplate.resourceId } : null,
      activeVideoTemplate ? { type: 'VIDEO_TEMPLATE', id: activeVideoTemplate.resourceId } : null,
    ].filter((item): item is { type: ResourceType; id: string } => Boolean(item?.id));

    if (templates.length === 0) return;

    setActiveResources((prev) =>
      prev.filter(
        (item) =>
          !templates.some(
            (template) =>
              item.resourceType === template.type && item.resourceId === template.id,
          ),
      ),
    );

    await Promise.all(
      templates.map((template) =>
        marketplaceActions.detachConversationResource(
          conversationId,
          template.type,
          template.id,
        ),
      ),
    );
  };

  const uploadChatImages = async (images?: string[]) => {
    if (!images?.length) return [];

    const uploaded: string[] = [];

    for (const image of images) {
      if (!image.startsWith('data:')) {
        uploaded.push(image);
        continue;
      }

      let uploadedImage: { publicUrl: string };
      try {
        uploadedImage = await uploadBase64ImageToStorage(image, {
          folder: 'amux-studio/chat-uploads',
        });
      } catch (error) {
        throw error;
      }

      const publicUrl = typeof uploadedImage.publicUrl === 'string' ? uploadedImage.publicUrl : '';

      if (!publicUrl) {
        throw new Error(t('error.imageUploadMissingUrl'));
      }

      uploaded.push(publicUrl);
    }

    return uploaded;
  };

  const uploadChatAttachments = async (
    attachments?: LocalChatAttachment[],
  ): Promise<ChatAttachment[]> => {
    if (!attachments?.length) return [];

    const uploaded: ChatAttachment[] = [];
    for (const attachment of attachments) {
      if (!attachment.file) {
        uploaded.push(...normalizeChatAttachments([attachment]));
        continue;
      }

      const uploadedFile = await uploadFileToStorage(attachment.file, {
        contentType: attachment.mimeType,
        folder: 'amux-studio/chat-attachments',
      });

      uploaded.push({
        url: uploadedFile.publicUrl,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        kind: attachment.kind,
      });
    }

    return uploaded;
  };

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

  const refreshResources = async () => {
    if (!activeSessionId) {
      setActiveResources([]);
      return;
    }
    try {
      const items = await marketplaceActions.listConversationResources(activeSessionId);
      setActiveResources(items);
    } catch {
      setActiveResources([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!activeSessionId) {
        setActiveResources([]);
        return;
      }
      try {
        const items = await marketplaceActions.listConversationResources(activeSessionId);
        if (!cancelled) {
          setActiveResources(items);
        }
      } catch {
        if (!cancelled) setActiveResources([]);
      }
    };
    void refresh();
    const handler = () => void refresh();
    window.addEventListener('conversation-resources:changed', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('conversation-resources:changed', handler);
    };
  }, [activeSessionId]);

  const prevTemplateIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentTemplateId = activeImageTemplate?.resourceId;
    if (currentTemplateId === prevTemplateIdRef.current) return;

    if (!currentTemplateId) {
      prevTemplateIdRef.current = undefined;
      setTemplateVariables({});
      setSelectedRefImages([]);
      setPromptInject(null);
      return;
    }

    const template = imageTemplateResource;
    if (!template) return;

    prevTemplateIdRef.current = currentTemplateId;

    const defaultValues: Record<string, string> = {};
    for (const v of (template.variables ?? []) as Array<{ key: string; default?: string }>) {
      defaultValues[v.key] = v.default ?? '';
    }
    setTemplateVariables(defaultValues);

    setSelectedRefImages([]);

    const composed = composeTemplatePrompt(template.prompt ?? '', defaultValues);
    setPromptInject((prev) => ({
      content: composed,
      token: (prev?.token ?? 0) + 1,
    }));
  }, [activeImageTemplate?.resourceId, imageTemplateResource]);

  const prevVideoTemplateIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentId = activeVideoTemplate?.resourceId;
    if (currentId === prevVideoTemplateIdRef.current) return;

    if (!currentId) {
      prevVideoTemplateIdRef.current = undefined;
      return;
    }

    const tpl = videoTemplateResource;
    if (!tpl) return;

    prevVideoTemplateIdRef.current = currentId;

    const dur = tpl.durationSec ?? 5;
    if (tpl.durationSec) videoInput.setDuration(dur);
    if (tpl.defaultParams?.ratio) videoInput.setRatio(tpl.defaultParams.ratio);
    const mode = (tpl.defaultParams?.mode ?? 'reference') as typeof videoInput.mode;
    if (tpl.defaultParams?.mode) videoInput.setModeRaw(mode);
    if (tpl.modelHint) videoInput.setModel(tpl.modelHint);

    videoInput.setMaterials([]);
    videoInput.resetFramesForMode(mode);

    const defaultValues: Record<string, string> = {};
    for (const v of (tpl.variables ?? []) as Array<{ key: string; default?: string }>) {
      defaultValues[v.key] = v.default ?? '';
    }
    setTemplateVariables(defaultValues);

    setSelectedRefImages([]);

    const composed = composeTemplatePrompt(tpl.prompt ?? '', defaultValues);
    setPromptInject((prev) => ({
      content: composed,
      token: (prev?.token ?? 0) + 1,
    }));

    setPromptDialogOpen(true);
  }, [activeVideoTemplate?.resourceId, videoTemplateResource]);

  useEffect(() => {
    listAvailableModels()
      .then((availableModels) => {
        const models = availableModels.filter((m) =>
          Array.isArray(m.capabilities) && m.capabilities.includes('image'),
        );
        setImageModels(models);
      })
      .catch(() => setImageModels([]));
  }, []);

  useEffect(() => {
    if (!imageTemplateResource) {
      setSelectedSourceImages([]);
      return;
    }
    const defaults: Record<string, string> = {};
    for (const variable of imageTemplateResource.variables ?? []) {
      if (variable?.key) defaults[variable.key] = variable.default ?? '';
    }
    setTemplateVariables(defaults);
    const hint = imageTemplateResource.modelHint;
    const hinted = imageModels.find((m) =>
      hint && (m.model === hint || m.id === hint || m.name === hint),
    );
    const target = hinted ?? imageModels[0];
    if (target?.id) {
      setSelectedModel(target.id);
    }
  }, [imageTemplateResource?.id, imageTemplateResource?.modelHint, imageModels.length, setSelectedModel]);

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

    const aiMessages = activeSession.messages.map((msg: any, idx: number) => {
      const metadata = msg.metadata ?? {};
      const messageType = msg.messageType || metadata.messageType || (msg.uiResponse || metadata.uiResponse ? 'ui' : 'markdown');

      const rawTimestamp = msg.createdAt ?? msg.timestamp ?? null;
      const parsedDate = rawTimestamp ? new Date(rawTimestamp) : null;
      const safeDate =
        parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();

      const aiMsg: any = {
        id: msg.id,
        role: msg.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
        messageType,
        content: msg.content,
        payload: metadata,
        metadata,
        timestamp: safeDate,
        durationMs:
          typeof msg.durationMs === 'number'
            ? msg.durationMs
            : typeof metadata.durationMs === 'number'
              ? metadata.durationMs
              : undefined,
      };

      // 如果消息有 UI 数据,优先从顶层读取,其次从 metadata 读取
      if (msg.uiResponse || metadata.uiResponse) {
        aiMsg.uiResponse = msg.uiResponse || metadata.uiResponse;
      }
      if (metadata.uiStage) {
        aiMsg.uiStage = metadata.uiStage;
      }
      if (metadata.interactionState) {
        aiMsg.interactionState = metadata.interactionState;
      }

      // 提取 thinking（优先从顶层，其次从 uiResponse，最后从 metadata）
      if (msg.thinking) {
        aiMsg.thinking = msg.thinking;
      } else if (msg.uiResponse?.thinking) {
        aiMsg.thinking = msg.uiResponse.thinking;
      } else if (metadata.thinking) {
        aiMsg.thinking = metadata.thinking;
      }

      return aiMsg;
    });

    setAIUIMessages(aiMessages);
  }, [activeSession?.id, activeSession?.messages.length]);

  useEffect(() => {
    // 只在会话存在且有消息时滚动
    if (!activeSession?.id || aiUIMessages.length === 0) {
      return;
    }
  }, [activeSession?.id, aiUIMessages.length]);

  const resolvedTemplatePrompt = composeTemplatePrompt(
    imageTemplateResource?.prompt ?? '',
    templateVariables,
  );

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
      uploadedInputImages = await uploadChatImages(payload?.inputImages);
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

  const handleChatStreamMessage = (
    conversationId: string,
    msg: StreamMessage,
    options: {
      includeImageMessages?: boolean;
      errorLogLabel?: string;
      clearWaitingOnError?: boolean;
    } = {},
  ) => {
    switch (msg.messageType) {
      case 'markdown': {
        const markdownPayload = msg.payload as MarkdownPayload;
        if (markdownPayload.content) {
          appendToLastAssistantMessage(conversationId, markdownPayload.content);
          updateStreamingMessage(markdownPayload.content);
        }
        break;
      }

      case 'ui': {
        const uiPayload = msg.payload as UIPayload;
        if (uiPayload) {
          setLastAssistantUIResponse({
            messages: uiPayload.components,
            thinking: uiPayload.thinking,
          });
          updateStreamingMessage('', {
            messages: uiPayload.components,
            thinking: uiPayload.thinking,
          });
        }
        break;
      }

      case 'meta': {
        const metaPayload = msg.payload as MetaPayload;
        if (metaPayload?.uiStage) {
          setStage(metaPayload.uiStage);
        }
        break;
      }

      case 'progress': {
        const progressPayload = msg.payload as ProgressPayload;
        if (progressPayload) {
          setProgress({
            stepKey: progressPayload.stepKey,
            displayName: progressPayload.displayName,
            index: progressPayload.index,
            total: progressPayload.total,
            status: progressPayload.status,
          });
        }
        break;
      }

      case 'log': {
        const logPayload = msg.payload as LogPayload;
        if (logPayload) {
          if (logPayload.level === 'error') {
            console.error(`[Server Log] ${logPayload.message}`, logPayload.data);
          } else if (logPayload.level === 'debug') {
            console.debug(`[Server Log] ${logPayload.message}`, logPayload.data);
          } else {
            console.log(`[Server Log] ${logPayload.message}`, logPayload.data);
          }
        }
        break;
      }

      case 'prompt_suggestion':
      case 'edit_suggestion':
      case 'image_generating':
      case 'image_editing':
      case 'image_result':
        if (options.includeImageMessages) {
          addAIUIMessage({
            id: `${msg.messageType}-${Date.now()}`,
            role: 'assistant',
            messageType: msg.messageType,
            content: '',
            payload: msg.payload,
            timestamp: new Date(),
          } as any);
          if (msg.messageType === 'image_result') {
            setSelectedSourceImages([]);
          }
        }
        break;

      case 'artifact_created': {
        const artifactCreatedPayload = msg.payload as ArtifactCreatedPayload;
        if (artifactCreatedPayload?.artifactId) {
          console.log(`[Artifact Created] ${artifactCreatedPayload.title} (${artifactCreatedPayload.artifactId})`);
          loadArtifactById(artifactCreatedPayload.artifactId)
            .catch((error) => {
              console.error('Failed to load artifact:', error);
            });
        }
        break;
      }

      case 'done': {
        setStreaming(false);
        clearProgress();
        const donePayload = msg.payload as { durationMs?: number } | null;
        finalizeAIUIStreaming(
          donePayload && typeof donePayload.durationMs === 'number'
            ? { durationMs: donePayload.durationMs }
            : undefined,
        );
        break;
      }

      case 'error': {
        const errPayload = msg.payload as { error?: string } | null;
        const errMsg = errPayload?.error || t('unknownError');
        console.error(options.errorLogLabel ?? 'Server returned an error', errMsg);
        setChatError(errMsg);
        setStreaming(false);
        if (options.clearWaitingOnError) setIsWaitingFirstResponse(false);
        finalizeAIUIStreaming();
        abortRef.current?.abort();
        break;
      }
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

  const formatUIActionText = (action: string, data: Record<string, unknown>): string => {
    if (action === 'submit') {
      if (data.selectedType) {
        const typeLabels: Record<string, string> = {
          new_feature: t('uiAction.types.newFeature'),
          bug_fix: t('uiAction.types.bugFix'),
          optimization: t('uiAction.types.optimization'),
          refactoring: t('uiAction.types.refactoring'),
        };
        const typeLabel = typeLabels[data.selectedType as string] || data.selectedType;
        return t('uiAction.selectedType', { type: String(typeLabel) });
      } else if (data.requirementTitle || data.targetUsers) {
        const parts: string[] = [];
        if (data.requirementTitle) {
          parts.push(t('uiAction.requirementTitle', { value: String(data.requirementTitle) }));
        }
        if (data.targetUsers) {
          parts.push(t('uiAction.targetUsers', { value: String(data.targetUsers) }));
        }
        if (data.businessGoal) {
          parts.push(t('uiAction.businessGoal', { value: String(data.businessGoal) }));
        }
        if (data.functionalDescription) {
          parts.push(t('uiAction.functionalDescription', { value: String(data.functionalDescription) }));
        }
        return parts.join('\n');
      } else {
        return t('uiAction.confirmSubmit');
      }
    } else if (action === 'cancel') {
      return t('uiAction.cancelAction');
    }
    return t('uiAction.executeAction', { action });
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

  if (isLoadingSessions) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent text-muted-foreground">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
          <p className="text-sm">{tc('loading')}</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <header className="flex h-12 w-full min-w-0 shrink-0 items-center gap-2 border-b border-white/10 bg-black/12 px-3">
          {sidebarCtx && (
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={sidebarCtx.toggleSidebar}
            >
              <PanelLeftIcon className="size-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </button>
          )}
        </header>
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="text-muted-foreground">
              <Laugh aria-hidden="true" />
            </EmptyMedia>
            <EmptyDescription>{t('selectOrCreateChat')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const parsedChatError = chatError
    ? splitErrorMessage(chatError, t('error.requestFailedTitle'))
    : null;

  const chatColumn = (
    <div className="relative flex h-full min-w-0 overflow-hidden bg-transparent">
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-12 w-full min-w-0 shrink-0 items-center gap-2 border-b border-white/10 bg-black/12 px-3">
          {sidebarCtx && (
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={sidebarCtx.toggleSidebar}
            >
              <PanelLeftIcon className="size-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </button>
          )}
        </header>

        {parsedChatError && (
          <div className="mx-auto w-full max-w-3xl px-6 pt-3">
            <Alert
              variant="destructive"
              className="relative border-destructive/40 bg-destructive/10 pr-10 text-destructive"
            >
              <AlertCircle />
              <AlertTitle>{parsedChatError.title}</AlertTitle>
              <AlertDescription>
                <ErrorMessageBody message={parsedChatError.body} />
              </AlertDescription>
              <button
                type="button"
                aria-label={t('dismiss')}
                className="absolute right-2 top-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setChatError(null)}
              >
                <X className="size-3.5" />
              </button>
            </Alert>
          </div>
        )}

        <div className="relative min-h-0 flex-1 bg-transparent">
          <Conversation className="relative z-0 h-full flex-1 min-w-0 py-8">
            <ConversationContent className="mx-auto w-full min-w-0 max-w-3xl gap-6 px-6">
              {aiUIMessages.length === 0 && !isLocked && activeSessionId && !templateSheetOpen && !activeModeTemplate && (
                <div className="flex flex-col items-center gap-4 py-16">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {t('emptyGreeting')}
                  </h2>
                  <ModelConfigTip hasModels={availableModels.length > 0} className="mt-2" />
                </div>
              )}

              {aiUIMessages.map((msg, i) => {
                if (msg.role === 'user') {
                  return (
                    <MessageBubble
                      key={msg.id}
                      role="user"
                      content={msg.content || ''}
                      images={(msg as any).payload?.images ?? (msg as any).metadata?.images ?? []}
                      attachments={(msg as any).payload?.attachments ?? (msg as any).metadata?.attachments ?? []}
                      timestamp={(msg as any).timestamp ?? (msg as any).createdAt}
                    />
                  );
                }
                if (msg.messageType === 'ui') {
                  return (
                    <div key={msg.id} className="w-full">
                      <AIUIRenderer
                        components={msg.uiResponse?.messages || []}
                        thinking={msg.thinking || msg.uiResponse?.thinking || undefined}
                        interactionState={msg.interactionState}
                        onAction={handleUIAction}
                        disabled={isStreaming || (isWaitingForUser && i !== aiUIMessages.length - 1)}
                      />
                    </div>
                  );
                }
                return (
                  <MessageBubble
                    key={msg.id}
                    role="assistant"
                    content={msg.content || ''}
                    thinking={msg.thinking || undefined}
                    isStreaming={msg.isStreaming}
                    messageType={msg.messageType}
                    payload={(msg as any).payload}
                    timestamp={(msg as any).timestamp ?? (msg as any).createdAt}
                    durationMs={(msg as any).durationMs}
                    onGenerateImage={handleGenerateImage}
                    onSelectSourceImage={toggleSourceImage}
                  />
                );
              })}

              {streamingMessage &&
                (streamingMessage.uiResponse || streamingMessage.content) && (
                  streamingMessage.uiResponse ? (
                    <div className="w-full">
                      <AIUIRenderer
                        components={streamingMessage.uiResponse.messages || []}
                        thinking={streamingMessage.thinking || streamingMessage.uiResponse?.thinking || undefined}
                        interactionState={streamingMessage.interactionState}
                        onAction={handleUIAction}
                        disabled={isStreaming}
                      />
                    </div>
                  ) : (
                    <MessageBubble
                      role="assistant"
                      content={streamingMessage.content || ''}
                      thinking={streamingMessage.thinking || undefined}
                      isStreaming={streamingMessage.isStreaming}
                      messageType={(streamingMessage as any).messageType}
                      payload={(streamingMessage as any).payload}
                      timestamp={(streamingMessage as any).timestamp}
                      durationMs={(streamingMessage as any).durationMs}
                      onGenerateImage={handleGenerateImage}
                      onSelectSourceImage={toggleSourceImage}
                    />
                  )
                )}

              {isStreaming &&
                !isImageWorkflowRunning &&
                (!streamingMessage ||
                  (!streamingMessage.content && !streamingMessage.uiResponse)) && (
                  <ThinkingIndicator progress={currentProgress} />
                )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

        </div>

        <div className="pointer-events-none relative z-30 w-full min-w-0 flex-shrink-0 px-6 pb-6 pt-2">
          <div
            className={`pointer-events-auto mx-auto w-full min-w-0 max-w-3xl rounded-2xl${templateSheetOpen ? ' border border-white/14 px-3 pb-2 pt-1 shadow-[0_24px_90px_rgba(0,0,0,0.35)]' : ''}`}
            style={templateSheetOpen ? {
              background:
                'linear-gradient(180deg, rgba(20,20,20,0.82), rgba(8,8,8,0.72))',
              backdropFilter: 'blur(34px) saturate(180%)',
              WebkitBackdropFilter: 'blur(34px) saturate(180%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.10), 0 24px 90px rgba(0,0,0,0.34)',
            } : undefined}
          >
            <div className="mb-2 flex justify-start">
              <InputModeSwitch
                value={visibleInputMode}
                onChange={handleInputModeChange}
                disabled={isStreaming || isSwitchingMode}
              />
            </div>
            <ChatPromptInput
              onSend={handleSend}
              isStreaming={isStreaming}
              inputKind={inputKind}
              resetToken={composerResetToken}
              enableImages={inputKind !== 'video' && (modelSupportsVision || inputKind === 'image')}
              enableVideo={inputKind === 'video'}
              imageWorkflowActive={inputKind === 'image'}
              headerSlot={inputKind === 'video' && !templateSheetOpen ? (
                <VideoInputArea
                  mode={videoInput.mode}
                  materials={videoInput.materials}
                  frames={videoInput.frames}
                  onAddMaterial={videoInput.addMaterials}
                  onRemoveMaterial={videoInput.removeMaterial}
                  onAddFrame={videoInput.addFrame}
                  onRemoveFrame={videoInput.removeFrame}
                  onSwapFirstLastFrames={videoInput.swapFirstLastFrames}
                  onFrameFileUpload={videoInput.setFrameFile}
                  onClearAll={videoInput.clearFrames}
                />
              ) : undefined}
              onPasteFiles={activeKind === 'video' ? videoInput.pasteFiles : undefined}
              estimatedCost={inputEstimate?.estimatedCost ?? null}
              estimatingCost={inputEstimateLoading}
              selectedSourceImages={inputKind === 'image' ? selectedSourceImages : []}
              onGenerateImage={handleGenerateImageFromInput}
              onRemoveSourceImage={(index) =>
                setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index))
              }
              onClearSourceImages={() => setSelectedSourceImages([])}
              activeTemplate={(inputKind === 'image' || inputKind === 'video') && activeModeTemplateResource ? {
                id: activeModeTemplate?.resourceId ?? '',
                title: activeModeTemplateResource?.title ?? '',
                coverImage: inputKind === 'image' ? imageTemplateResource?.coverImage : undefined,
                variableCount: (activeModeTemplateResource?.variables ?? []).length,
              } : undefined}
              onOpenTemplateEditor={(inputKind === 'image' || inputKind === 'video') && activeModeTemplateResource ? () => setPromptDialogOpen(true) : undefined}
              onReuseTemplate={(inputKind === 'image' || inputKind === 'video') && activeModeTemplateResource ? () => {
                const composed = composeTemplatePrompt(
                  activeModeTemplateResource?.prompt ?? '',
                  templateVariables,
                );
                setPromptInject((prev) => ({
                  content: composed,
                  images: inputKind === 'image' ? selectedRefImages : undefined,
                  token: (prev?.token ?? 0) + 1,
                }));
              } : undefined}
              injectValue={promptInject ?? undefined}
              glassEffect={templateSheetOpen}
              onRemoveTemplate={(inputKind === 'image' || inputKind === 'video') ? () => {
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
              } : undefined}
            />
            {activeKind === 'video' ? (
              <VideoToolbar
                model={videoInput.model}
                onModelChange={handleVideoModelChange}
                mode={videoInput.mode}
                onModeChange={videoInput.setMode}
                ratio={videoInput.ratio}
                onRatioChange={videoInput.setRatio}
                duration={videoInput.duration}
                onDurationChange={videoInput.setDuration}
                models={videoModels}
                modelsLoading={availableModels.length === 0}
                activeTemplateName={videoTemplateResource?.title}
                onOpenTemplateDrawer={() => {
                  setTemplateSheetOpen(true);
                  if (sidebarCtx?.open) sidebarCtx.setOpen(false);
                }}
              />
            ) : (
              <ChatToolbar
                kind={inputKind}
                conversationId={activeSessionId ?? undefined}
                activeTemplateName={imageTemplateResource?.title}
                imageSize={imageSize}
                imageQuality={imageQuality}
                imageCount={imageCount}
                onImageSizeChange={setImageSize}
                onImageQualityChange={setImageQuality}
                onImageCountChange={setImageCount}
                onModelChange={handleToolbarModelChange}
                onOpenTemplateDrawer={() => {
                  setTemplateSheetOpen(true);
                  if (sidebarCtx?.open) sidebarCtx.setOpen(false);
                }}
                labels={{
                  selectModel: t('toolbar.selectModel'),
                  selectTemplate: t('toolbar.selectTemplate'),
                  chatModelTooltip: t('toolbar.chatModelTooltip'),
                  noModelsGoConfig: t('noModelsGoConfig'),
                  modelPicker: {
                    searchPlaceholder: t('modelPicker.searchPlaceholder'),
                    empty: t('modelPicker.empty'),
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ResourcePanel
        conversationId={activeSessionId ?? undefined}
        mode={isElectron ? 'electron' : 'web'}
      />

      {activeSessionId && (
        <ConversationImagesPanel
          conversationId={activeSessionId}
          refreshToken={generatedImages.length}
        />
      )}

      <TemplatePromptDialog
        open={promptDialogOpen}
        onOpenChange={setPromptDialogOpen}
        templateName={
          activeKind === 'video'
            ? (videoTemplateResource?.title ?? '')
            : (imageTemplateResource?.title ?? '')
        }
        templatePrompt={
          activeKind === 'video'
            ? (videoTemplateResource?.prompt ?? '')
            : (imageTemplateResource?.prompt ?? '')
        }
        variables={
          activeKind === 'video'
            ? (videoTemplateResource?.variables ?? [])
            : (imageTemplateResource?.variables ?? [])
        }
        referenceImages={(() => {
          if (activeKind === 'video') {
            return videoTemplateResource?.exampleMedia ?? [];
          }
          const cover = imageTemplateResource?.coverImage;
          const examples: string[] = imageTemplateResource?.exampleImages ?? [];
          const all = cover ? [cover, ...examples] : examples;
          return [...new Set(all)];
        })()}
        initialValues={templateVariables}
        initialSelectedRefs={selectedRefImages}
        onApply={(composed, values, refs) => {
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
        }}
      />

      <TemplatePickerDrawer
        open={templateSheetOpen}
        onOpenChange={setTemplateSheetOpen}
        kind={activeKind}
        conversationId={activeSessionId ?? ''}
        currentTemplateId={activeModeTemplate?.resourceId}
        onSelected={refreshResources}
      />
    </div>
  );

  if (!activeArtifact) {
    return <div className="h-full">{chatColumn}</div>;
  }

  return (
    <Group orientation="horizontal" className="h-full w-full" id="main-chat-group">
      <Panel
        id="chat-panel"
        defaultSize="40%"
        minSize="20%"
        maxSize="80%"
        style={{ minWidth: 0, overflow: 'hidden' }}
      >
        {chatColumn}
      </Panel>
      <Separator
        id="main-separator"
        style={{
          flexBasis: '12px',
          width: '12px',
          cursor: 'col-resize',
          background: 'transparent',
          zIndex: 1,
          userSelect: 'none',
        }}
      />
      <Panel
        id="artifact-panel"
        defaultSize="60%"
        minSize="20%"
        maxSize="80%"
        style={{ minWidth: 0, overflow: 'hidden' }}
      >
        <ArtifactPanel />
      </Panel>
    </Group>
  );
}
