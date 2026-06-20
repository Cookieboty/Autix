'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  conversationActions,
  hasImageCapability,
  marketplaceActions,
  uploadFileToStorage,
  useChatStore,
  type AnyResource,
  type ChatAttachment,
  type ConversationKind,
  type ResourceType,
  type StreamMessage,
  type TemplateVariable,
} from '@autix/shared-store';
import { ChatPromptInput } from '../chat/ChatPromptInput';
import { ChatToolbar } from '../chat/ChatToolbar';
import { MessageBubble, type ImageResultItem } from '../chat/MessageBubble';
import { TemplatePromptDialog } from '../chat/TemplatePromptDialog';
import { composeTemplatePrompt } from '../chat/utils/composeTemplatePrompt';
import {
  sharedSendController,
  type SendControllerCallbacks,
} from '../chat/utils/sharedSendController';
import {
  getChatImageUrls,
  normalizeChatAttachments,
  type LocalChatAttachment,
} from '../chat/chat-attachments';
import { VideoInputArea, type VideoMaterial } from '../video/VideoInputArea';
import { VideoToolbar, type VideoGenMode } from '../video/VideoToolbar';
import { useVideoInputController } from '../video/useVideoInputController';

function materialToAttachment(material: VideoMaterial, index: number): LocalChatAttachment {
  const mimeType =
    material.type === 'video'
      ? 'video/mp4'
      : material.type === 'audio'
        ? 'audio/mpeg'
        : 'image/jpeg';
  return {
    id: `video-material-${material.id}-${index}`,
    url: material.url,
    name: material.name ?? `video-material-${index + 1}`,
    mimeType,
    size: 0,
    kind: material.type,
  };
}

function uniqueRefs(refs: Array<{ url: string }>): Array<{ url: string }> {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (!ref.url || seen.has(ref.url)) return false;
    seen.add(ref.url);
    return true;
  });
}

async function uploadDockAttachments(
  attachments?: LocalChatAttachment[],
): Promise<ChatAttachment[]> {
  if (!attachments?.length) return [];

  const uploaded: ChatAttachment[] = [];
  for (const attachment of attachments) {
    if (!attachment.file) {
      uploaded.push(...normalizeChatAttachments([attachment]));
      continue;
    }

    const { publicUrl } = await uploadFileToStorage(attachment.file, {
      contentType: attachment.mimeType,
      folder: 'amux-studio/chat-attachments',
    });

    uploaded.push({
      url: publicUrl,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
    });
  }

  return uploaded;
}

interface MarketplaceChatDockProps {
  template: AnyResource | null;
  resourceType: ResourceType;
  onClose: () => void;
}

interface DockMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    images?: string[];
    attachments?: ChatAttachment[];
  };
  messageType?: StreamMessage['messageType'];
  payload?: unknown;
  isStreaming?: boolean;
  timestamp?: Date;
}

interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

interface TemplateWithPrompt {
  prompt?: string;
  variables?: TemplateVariable[];
  coverImage?: string;
  exampleImages?: string[];
  exampleMedia?: string[];
  modelHint?: string;
  durationSec?: number;
  defaultParams?: {
    ratio?: string;
    resolution?: string;
    generateAudio?: boolean;
    mode?: string;
  };
}

export function MarketplaceChatDock({
  template,
  resourceType,
  onClose,
}: MarketplaceChatDockProps) {
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
  const variables: TemplateVariable[] = useMemo(
    () => (tpl?.variables as TemplateVariable[] | undefined) ?? [],
    [tpl],
  );
  const referenceImages = useMemo(() => {
    if (!tpl) return [];
    if (isVideoTemplate) return [...new Set(tpl.exampleMedia ?? [])];
    const refs = [
      ...(tpl.coverImage ? [tpl.coverImage] : []),
      ...(tpl.exampleImages ?? []),
    ];
    return [...new Set(refs)];
  }, [isVideoTemplate, tpl]);

  useEffect(() => {
    if (!template) return;
    const defaults: Record<string, string> = {};
    for (const v of variables) {
      defaults[v.key] = v.default ?? '';
    }
    const nextVideoMode = (tpl?.defaultParams?.mode ?? 'reference') as VideoGenMode;
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
    setInjectToken((t) => t + 1);
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
    setInjectToken((t) => t + 1);
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
    const kind: ConversationKind =
      resourceType === 'IMAGE_TEMPLATE'
        ? 'image'
        : resourceType === 'VIDEO_TEMPLATE'
          ? 'video'
          : 'chat';

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
        ? (
          videoInput.mode === 'reference'
            ? videoInput.materials
            : videoInput.frames.map((frame) => frame.material).filter((item): item is VideoMaterial => Boolean(item))
        ).map(materialToAttachment)
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
    async (payload?: {
      promptOverride?: string;
      editInstruction?: string;
      sourceImages?: SourceImageRef[];
      inputImages?: string[];
    }) => {
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

  if (!template) return null;

  const hasTemplateEditor = variables.length > 0 || referenceImages.length > 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[82vh] w-full max-w-3xl flex-col px-4 pb-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/14 bg-black/82 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        {(sessionId || messages.length > 0) && (
          <div className="flex items-center justify-end gap-2 border-b border-white/10 px-3 py-2">
            {sessionId && (
              <a
                href={`/c/${sessionId}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/52 transition-colors hover:bg-white/8 hover:text-white"
              >
                <ExternalLink className="size-3" />
                {t('fullConversation')}
              </a>
            )}
          </div>
        )}

        {messages.length > 0 && (
          <div className="max-h-[42vh] overflow-y-auto px-4 py-3">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                images={msg.metadata?.images}
                attachments={msg.metadata?.attachments}
                messageType={msg.messageType}
                payload={msg.payload}
                isStreaming={msg.isStreaming}
                timestamp={msg.timestamp}
                onGenerateImage={handleGenerateImage}
                onSelectSourceImage={toggleSourceImage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div className="px-4 py-2 text-xs text-destructive">{error}</div>
        )}

        <div className="p-3">
          <ChatPromptInput
            onSend={handleSend}
            isStreaming={isStreaming}
            inputKind={isVideoTemplate ? 'video' : isImageTemplate ? 'image' : 'chat'}
            enableImages={isImageTemplate}
            enableVideo={isVideoTemplate}
            imageWorkflowActive={isImageTemplate}
            selectedSourceImages={isImageTemplate ? selectedSourceImages : []}
            onGenerateImage={handleGenerateImageFromInput}
            onRemoveSourceImage={(index) =>
              setSelectedSourceImages((prev) => prev.filter((_, i) => i !== index))
            }
            onClearSourceImages={() => setSelectedSourceImages([])}
            headerSlot={isVideoTemplate ? (
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
            activeTemplate={{
              id: template.id,
              title: template.title,
              coverImage: isImageTemplate ? tpl?.coverImage : undefined,
              variableCount: variables.length,
              editable: hasTemplateEditor,
            }}
            onOpenTemplateEditor={hasTemplateEditor ? () => setPromptDialogOpen(true) : undefined}
            onReuseTemplate={reapplyTemplate}
            onRemoveTemplate={onClose}
            injectValue={injectValue}
            glassEffect
            onPasteFiles={videoInput.pasteFiles}
          />
          <div className="mt-2">
            {isVideoTemplate ? (
              <VideoToolbar
                mode={videoInput.mode}
                model={videoInput.model}
                onModelChange={videoInput.setModel}
                onModeChange={videoInput.setMode}
                ratio={videoInput.ratio}
                onRatioChange={videoInput.setRatio}
                duration={videoInput.duration}
                onDurationChange={videoInput.setDuration}
              />
            ) : (
              <ChatToolbar
                kind={isImageTemplate ? 'image' : 'chat'}
                conversationId={sessionId ?? undefined}
                imageSize={imageSize}
                imageQuality={imageQuality}
                imageCount={imageCount}
                onImageSizeChange={setImageSize}
                onImageQualityChange={setImageQuality}
                onImageCountChange={setImageCount}
              />
            )}
          </div>
        </div>
      </div>
      <TemplatePromptDialog
        open={promptDialogOpen}
        onOpenChange={setPromptDialogOpen}
        templateName={template.title}
        templatePrompt={tpl?.prompt ?? ''}
        variables={variables}
        referenceImages={referenceImages}
        initialValues={varValues}
        initialSelectedRefs={selectedRefs}
        onApply={(_composed, values, refs) => {
          setVarValues(values);
          setSelectedRefs(refs);
          if (isVideoTemplate) {
            videoInput.applyRefs(refs);
          }
          setInjectToken((t) => t + 1);
          setPromptDialogOpen(false);
        }}
      />
    </div>
  );
}
