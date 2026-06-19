'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  marketplaceActions,
  uploadFileToStorage,
  useChatStore,
} from '@autix/shared-store';
import {
  appendConversationMessage,
  authFetch,
  getApiBaseUrl,
  hasImageCapability,
  type AnyResource,
  type ChatAttachment,
  type ConversationKind,
  type ResourceType,
  type StreamMessage,
  type TemplateVariable,
} from '@autix/sdk';
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
import { VideoInputArea, type FrameSlot, type VideoMaterial } from '../video/VideoInputArea';
import { VideoToolbar, type VideoGenMode } from '../video/VideoToolbar';

const DEFAULT_VIDEO_FRAME_DURATION = 5;

function inferVideoMaterialType(url: string): VideoMaterial['type'] {
  const lower = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm|avi|mkv|flv|m4v)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a)$/.test(lower)) return 'audio';
  return 'image';
}

function createVideoTemplateMaterials(refs: string[]): VideoMaterial[] {
  const baseId = Date.now();
  return refs.map((url, index) => ({
    id: `tpl-mat-${baseId}-${index}`,
    url,
    name: `template-${index + 1}`,
    type: inferVideoMaterialType(url),
  }));
}

function isImageMaterial(material: VideoMaterial | null | undefined): material is VideoMaterial {
  return material?.type === 'image';
}

function createVideoFramesFromImages(
  materials: VideoMaterial[],
  mode: Exclude<VideoGenMode, 'reference'>,
  duration = DEFAULT_VIDEO_FRAME_DURATION,
): FrameSlot[] {
  const baseId = Date.now();
  const imageMaterials = materials.filter(isImageMaterial);
  const frames: FrameSlot[] = imageMaterials
    .slice(0, mode === 'first_last_frame' ? 2 : undefined)
    .map((material, index) => ({
      id: `frame-${baseId}-${index}`,
      material,
      duration,
    }));

  if (mode === 'first_last_frame') {
    while (frames.length < 2) {
      frames.push({ id: `frame-${baseId}-${frames.length}`, material: null, duration });
    }
  } else if (frames.length === 0) {
    frames.push({ id: `frame-${baseId}-0`, material: null, duration });
  }

  return frames;
}

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
  const [videoModel, setVideoModel] = useState('');
  const [videoMode, setVideoModeRaw] = useState<VideoGenMode>('reference');
  const [videoRatio, setVideoRatio] = useState('adaptive');
  const [videoDuration, setVideoDuration] = useState(DEFAULT_VIDEO_FRAME_DURATION);
  const [imageSize, setImageSize] = useState('auto');
  const [imageQuality, setImageQuality] = useState('standard');
  const [imageCount, setImageCount] = useState(1);
  const [videoMaterials, setVideoMaterials] = useState<VideoMaterial[]>([]);
  const [videoFrames, setVideoFrames] = useState<FrameSlot[]>([
    { id: 'frame-1', material: null, duration: DEFAULT_VIDEO_FRAME_DURATION },
    { id: 'frame-2', material: null, duration: DEFAULT_VIDEO_FRAME_DURATION },
  ]);
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

  const getVideoImageMaterialsForModeSwitch = useCallback(
    () => (
      videoMode === 'reference'
        ? videoMaterials
        : videoFrames.map((frame) => frame.material)
    ).filter(isImageMaterial),
    [videoFrames, videoMaterials, videoMode],
  );

  const setVideoMode = useCallback(
    (mode: VideoGenMode) => {
      if (mode === videoMode) return;
      const imageMaterials = getVideoImageMaterialsForModeSwitch();
      setVideoModeRaw(mode);
      if (mode === 'reference') {
        setVideoMaterials(imageMaterials);
      } else {
        setVideoFrames(createVideoFramesFromImages(imageMaterials, mode));
      }
    },
    [getVideoImageMaterialsForModeSwitch, videoMode],
  );

  const applyVideoRefs = useCallback(
    (refs: string[], mode = videoMode) => {
      const mats = createVideoTemplateMaterials(refs);
      if (mode === 'reference') {
        setVideoMaterials(mats);
      } else {
        setVideoFrames(createVideoFramesFromImages(mats, mode));
      }
    },
    [videoMode],
  );

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
      setVideoModeRaw(nextVideoMode);
      setVideoRatio(tpl?.defaultParams?.ratio ?? 'adaptive');
      setVideoDuration(tpl?.durationSec ?? DEFAULT_VIDEO_FRAME_DURATION);
      setVideoModel(tpl?.modelHint ?? '');
      const mats = createVideoTemplateMaterials(initialRefs);
      if (nextVideoMode === 'reference') {
        setVideoMaterials(mats);
        setVideoFrames(createVideoFramesFromImages([], 'first_last_frame'));
      } else {
        setVideoMaterials([]);
        setVideoFrames(createVideoFramesFromImages(mats, nextVideoMode));
      }
      setPromptDialogOpen(true);
    } else {
      setVideoMaterials([]);
      setVideoFrames(createVideoFramesFromImages([], 'first_last_frame'));
      setPromptDialogOpen(false);
    }
    setInjectToken((t) => t + 1);
  }, [template?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const swapFirstLastFrames = useCallback(() => {
    setVideoFrames((prev) => {
      const next = prev.slice(0, Math.max(prev.length, 2));
      while (next.length < 2) {
        next.push({
          id: `frame-${Date.now()}-${next.length}`,
          material: null,
          duration: DEFAULT_VIDEO_FRAME_DURATION,
        });
      }
      const firstMaterial = next[0]?.material ?? null;
      const lastMaterial = next[1]?.material ?? null;
      return [
        { ...next[0], material: lastMaterial },
        { ...next[1], material: firstMaterial },
        ...prev.slice(2),
      ];
    });
  }, []);

  const addVideoMaterials = useCallback((files: File[]) => {
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        const type = file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'image';
        setVideoMaterials((prev) => [
          ...prev,
          { id: `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, name: file.name, type },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const setFrameFile = useCallback((frameId: string, files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const mat: VideoMaterial = { id: `mat-${Date.now()}`, url, name: file.name, type };
      setVideoFrames((prev) =>
        prev.map((frame) => frame.id === frameId ? { ...frame, material: mat } : frame),
      );
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePasteFiles = useCallback(
    (files: File[]) => {
      if (!isVideoTemplate) return;
      const readers = files.map((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          const type = file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'image';
          const mat: VideoMaterial = {
            id: `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            url,
            name: file.name,
            type,
          };
          if (videoMode === 'reference') {
            setVideoMaterials((prev) => [...prev, mat]);
          } else if (videoMode === 'first_last_frame') {
            setVideoFrames((prev) => {
              const firstEmpty = prev.findIndex((frame) => !frame.material);
              if (firstEmpty >= 0) {
                return prev.map((frame, index) => index === firstEmpty ? { ...frame, material: mat } : frame);
              }
              return prev.map((frame, index) => index === 0 ? { ...frame, material: mat } : frame);
            });
          } else {
            setVideoFrames((prev) => {
              const firstEmpty = prev.findIndex((frame) => !frame.material);
              if (firstEmpty >= 0) {
                return prev.map((frame, index) => index === firstEmpty ? { ...frame, material: mat } : frame);
              }
              return [
                ...prev,
                { id: `frame-${Date.now()}`, material: mat, duration: DEFAULT_VIDEO_FRAME_DURATION },
              ];
            });
          }
        };
        return { reader, file };
      });
      readers.forEach(({ reader, file }) => reader.readAsDataURL(file));
    },
    [isVideoTemplate, videoMode],
  );

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
      } catch {}
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
          videoMode === 'reference'
            ? videoMaterials
            : videoFrames.map((frame) => frame.material).filter((item): item is VideoMaterial => Boolean(item))
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
          modelId: isVideoTemplate ? videoModel || undefined : undefined,
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
    [template, isStreaming, ensureTemplateSession, isVideoTemplate, videoMode, videoMaterials, videoFrames, videoModel, pushMessage, scrollToBottom, finishLastAssistantMessage, t],
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
          await appendConversationMessage(convId, {
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
        const response = await authFetch(
          `${getApiBaseUrl()}/api/conversations/${convId}/generate-image`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            }),
            signal: abortRef.current.signal,
          },
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error(t('requestFailed'));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const dataLine = part
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (!dataLine) continue;

            const msg = JSON.parse(dataLine.slice(6)) as StreamMessage;
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
          }
        }
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
                mode={videoMode}
                materials={videoMaterials}
                frames={videoFrames}
                onAddMaterial={addVideoMaterials}
                onRemoveMaterial={(id) => {
                  setVideoMaterials((prev) => prev.filter((mat) => mat.id !== id));
                }}
                onAddFrame={() =>
                  setVideoFrames((prev) => [
                    ...prev,
                    { id: `frame-${Date.now()}`, material: null, duration: DEFAULT_VIDEO_FRAME_DURATION },
                  ])
                }
                onRemoveFrame={(id) => {
                  setVideoFrames((prev) => prev.filter((frame) => frame.id !== id));
                }}
                onSwapFirstLastFrames={() => {
                  swapFirstLastFrames();
                }}
                onFrameFileUpload={setFrameFile}
                onClearAll={() => {
                  setVideoFrames([
                    { id: 'frame-1', material: null, duration: DEFAULT_VIDEO_FRAME_DURATION },
                  ]);
                }}
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
            onPasteFiles={handlePasteFiles}
          />
          <div className="mt-2">
            {isVideoTemplate ? (
              <VideoToolbar
                mode={videoMode}
                model={videoModel}
                onModelChange={setVideoModel}
                onModeChange={(mode) => {
                  setVideoMode(mode);
                }}
                ratio={videoRatio}
                onRatioChange={setVideoRatio}
                duration={videoDuration}
                onDurationChange={setVideoDuration}
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
            applyVideoRefs(refs);
          }
          setInjectToken((t) => t + 1);
          setPromptDialogOpen(false);
        }}
      />
    </div>
  );
}
