'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../navigation';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useChatStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useResourcePanelStore } from '@autix/shared-store';
import { PanelLeftIcon, Laugh, AlertCircle, X } from 'lucide-react';
import { appendConversationMessage, conversationResourcesApi, getApiBaseUrl, type AgentKind, type VideoTemplate } from '@autix/shared-lib';
import { MessageBubble } from './MessageBubble';
import { ChatPromptInput } from './ChatPromptInput';
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
import { ModeSwitcher } from './ModeSwitcher';
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
import { VideoClipSidebar } from '../video/VideoClipSidebar';
import type { UIAction, StreamMessage, MarkdownPayload, UIPayload, MetaPayload, ProgressPayload, LogPayload, ArtifactCreatedPayload } from '@autix/shared-lib';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { artifactApi, getAvailableModels } from '@autix/shared-lib';
import { useTranslations } from 'next-intl';

interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

/** 把错误字符串拆成 title（首句）+ body（剩余） */
function splitErrorMessage(raw: string): { title: string; body: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { title: '请求失败', body: '' };
  // 优先按句号 / 中文句号 / 换行 / "(" 拆首句
  const m = trimmed.match(/^([^.。\n(]{0,80})([.。\n(][\s\S]*)?$/);
  if (m && m[2]) {
    return { title: m[1].trim(), body: m[2].replace(/^[.。\n]\s*/, '').trim() };
  }
  return { title: trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed, body: '' };
}

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

/** 把 body 内的 URL 自动渲染为可点击 link */
function ErrorMessageBody({ message }: { message: string }) {
  if (!message) return null;
  const parts = message.split(URL_PATTERN);
  return (
    <p className="break-all">
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-destructive"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
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

  const { activeArtifact, setActiveArtifact, clearArtifact } = useArtifactStore();
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
  const imageWorkflowRunningRef = useRef(false);

  // Video mode state
  const [videoGenMode, setVideoGenModeRaw] = useState<'reference' | 'first_last_frame' | 'smart_multiframe'>('reference');
  const setVideoGenMode = (mode: 'reference' | 'first_last_frame' | 'smart_multiframe') => {
    setVideoGenModeRaw(mode);
    if (mode === 'first_last_frame') {
      setVideoFrames((prev) => {
        if (prev.length >= 2) return prev.slice(0, 2);
        const frames = [...prev];
        while (frames.length < 2) frames.push({ id: `frame-${Date.now()}-${frames.length}`, material: null, duration: videoDuration });
        return frames;
      });
    } else if (mode === 'smart_multiframe') {
      setVideoFrames((prev) => prev.length > 0 ? prev : [{ id: 'frame-1', material: null, duration: videoDuration }]);
    }
  };
  const [videoModel, setVideoModel] = useState('');
  const [videoRatio, setVideoRatio] = useState('自动匹配');
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoMaterials, setVideoMaterials] = useState<Array<{ id: string; url: string; name?: string; type: 'image' | 'video' | 'audio' }>>([]);
  const [videoFrames, setVideoFrames] = useState<Array<{ id: string; material: { id: string; url: string; name?: string; type: 'image' | 'video' | 'audio' } | null; duration: number }>>([
    { id: 'frame-1', material: null, duration: 5 },
    { id: 'frame-2', material: null, duration: 5 },
  ]);
  const [videoClipSidebarOpen, setVideoClipSidebarOpen] = useState(false);


  const activeSession = getActiveSession();
  const activeAgentResource = activeResources.find((item) => item.resourceType === 'AGENT');
  const activeAgent = activeAgentResource?.resource as { id?: string; title?: string; kind?: AgentKind } | undefined;
  const isLocked = (activeSession?.messages?.length ?? 0) > 0;
  const activeImageTemplate = activeResources.find((item) => item.resourceType === 'IMAGE_TEMPLATE');
  const activeVideoTemplate = activeResources.find((item) => item.resourceType === 'VIDEO_TEMPLATE');
  const imageTemplateResource = activeImageTemplate?.resource as any | undefined;
  const videoTemplateResource = activeVideoTemplate?.resource as VideoTemplate | undefined;
  const selectedModel = availableModels.find((m) => m.id === selectedModelId);
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
  const derivedKind: AgentKind = Boolean(activeVideoTemplate)
    ? 'video'
    : hasImageHistory
      ? 'image'
      : ((activeAgent?.kind as AgentKind) ?? 'chat');
  const activeKind: AgentKind = derivedKind;
  const inputKind: AgentKind = activeKind;

  const uploadChatImages = async (images?: string[]) => {
    if (!images?.length) return [];

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    const uploaded: string[] = [];

    for (const image of images) {
      if (!image.startsWith('data:')) {
        uploaded.push(image);
        continue;
      }

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(`${getApiBaseUrl()}/api/storage/upload-base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            image,
            folder: 'amux-studio/chat-uploads',
          }),
        });
      } catch (error) {
        throw error;
      }

      if (!uploadResponse.ok) {
        throw new Error('图片上传失败');
      }

      const uploadPayload = await uploadResponse.json() as {
        data?: { publicUrl: string };
        publicUrl?: string;
      };
      const uploadedImage = uploadPayload.data ?? uploadPayload;
      const publicUrl = typeof uploadedImage.publicUrl === 'string' ? uploadedImage.publicUrl : '';

      if (!publicUrl) {
        throw new Error('图片上传响应缺少 URL');
      }

      uploaded.push(publicUrl);
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

  const refreshResources = async () => {
    if (!activeSessionId) {
      setActiveResources([]);
      return;
    }
    try {
      const res = await conversationResourcesApi.list(activeSessionId);
      setActiveResources(res.data ?? []);
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
        const res = await conversationResourcesApi.list(activeSessionId);
        if (!cancelled) {
          setActiveResources(res.data ?? []);
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

    const coverImage = template.coverImage;
    const defaultRefs = coverImage ? [coverImage] : [];
    setSelectedRefImages(defaultRefs);

    const composed = composeTemplatePrompt(template.prompt ?? '', defaultValues);
    setPromptInject((prev) => ({
      content: composed,
      images: defaultRefs,
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
    if (tpl.durationSec) setVideoDuration(dur);
    if (tpl.defaultParams?.ratio) setVideoRatio(tpl.defaultParams.ratio);
    const mode = (tpl.defaultParams?.mode ?? 'reference') as 'reference' | 'first_last_frame' | 'smart_multiframe';
    if (tpl.defaultParams?.mode) setVideoGenMode(mode);
    if (tpl.modelHint) setVideoModel(tpl.modelHint);

    const exMedia = tpl.exampleMedia ?? [];
    const mats = exMedia.map((url, i) => ({
      id: `tpl-mat-${Date.now()}-${i}`,
      url,
      name: `template-${i + 1}`,
      type: 'image' as const,
    }));

    if (mode === 'reference') {
      setVideoMaterials(mats);
    } else if (mode === 'first_last_frame') {
      const frames: typeof videoFrames = mats.slice(0, 2).map((m, i) => ({
        id: `frame-${Date.now()}-${i}`,
        material: m,
        duration: dur,
      }));
      while (frames.length < 2) {
        frames.push({ id: `frame-${Date.now()}-${frames.length}`, material: null, duration: dur });
      }
      setVideoFrames(frames);
    } else {
      setVideoFrames(mats.map((m, i) => ({
        id: `frame-${Date.now()}-${i}`,
        material: m,
        duration: dur,
      })));
    }

    const defaultValues: Record<string, string> = {};
    for (const v of (tpl.variables ?? []) as Array<{ key: string; default?: string }>) {
      defaultValues[v.key] = v.default ?? '';
    }
    setTemplateVariables(defaultValues);

    setSelectedRefImages(exMedia);

    const composed = composeTemplatePrompt(tpl.prompt ?? '', defaultValues);
    setPromptInject((prev) => ({
      content: composed,
      images: [],
      token: (prev?.token ?? 0) + 1,
    }));

    setPromptDialogOpen(true);
  }, [activeVideoTemplate?.resourceId, videoTemplateResource]);

  useEffect(() => {
    getAvailableModels()
      .then((res) => {
        const models = ((res.data as any[]) ?? []).filter((m) =>
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

    // 加载当前会话的产物
    artifactApi
      .getByConversation(activeSessionId)
      .then((response) => {
        if (response.data) {
          setActiveArtifact(response.data);
        } else {
          clearArtifact();
        }
      })
      .catch((error) => {
        console.error('加载产物失败:', error);
        clearArtifact();
      });
  }, [activeSessionId, setActiveArtifact, clearArtifact]);

  useEffect(() => {
    const init = async () => {
      await fetchSessions();
      const state = useChatStore.getState();

      if (sessionId) {
        // URL 中指定了会话 ID，优先激活它
        const exists = state.sessions.find((s) => s.id === sessionId);
        if (exists) {
          await setActiveSession(sessionId);
          return;
        }
      }

      // 没有 URL 参数或找不到对应会话，回退到第一个或新建
      if (!state.activeSessionId) {
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
      setChatError('请先选择一个图片模板');
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
      setChatError(err.message ?? '图片上传失败');
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
        await appendConversationMessage(activeSessionId, {
          role: 'USER',
          content: instruction ?? '',
          metadata: userMetadata,
        });
      } catch (err: any) {
        setChatError(err.message ?? '消息保存失败');
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const response = await fetch(
        `${getApiBaseUrl()}/api/conversations/${activeSessionId}/generate-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
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
          }),
          signal: abortRef.current.signal,
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error(t('requestError'));

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
          const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const msg = JSON.parse(dataLine.slice(6)) as StreamMessage;
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
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setChatError(err.message ?? t('requestError'));
      setStreaming(false);
      setIsImageWorkflowRunning(false);
      imageWorkflowRunningRef.current = false;
      setIsWaitingFirstResponse(false);
      finalizeAIUIStreaming();
    }
  };

  const handleSend = async (content: string, images?: string[]) => {
    if (!activeSessionId) return;
    setChatError(null);

    if (activeKind === 'image') {
      return handleGenerateImage({
        editInstruction: content,
        inputImages: images,
      });
    }

    if (activeKind !== 'chat' && activeKind !== 'video') {
      setChatError(`${activeKind} 模式即将上线，暂不支持发送`);
      return;
    }

    if (isStreaming) {
      console.warn('[ChatView] 正在处理中，忽略重复请求');
      return;
    }

    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    let uploadedImages: string[] = [];
    try {
      uploadedImages = await uploadChatImages(images);
    } catch (err: any) {
      setChatError(err.message ?? '图片上传失败');
      setStreaming(false);
      setIsWaitingFirstResponse(false);
      return;
    }

    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata: uploadedImages.length > 0 ? { images: uploadedImages } : undefined,
    });

    addAIUIMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      payload: uploadedImages.length > 0 ? { images: uploadedImages } : undefined,
      timestamp: new Date(),
    } as any);

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

      await fetchEventSource(
        `${getApiBaseUrl()}/api/conversations/${activeSessionId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: content,
            modelId: selectedModelId ?? undefined,
            ...(uploadedImages.length ? { images: uploadedImages } : {}),
            sourceImages: selectedSourceImages.length > 0 ? selectedSourceImages : undefined,
          }),
          signal: abortRef.current.signal,

          onmessage(event) {
            // 收到第一个响应，关闭"思考中"状态
            setIsWaitingFirstResponse(false);

            try {
              const msg = JSON.parse(event.data) as StreamMessage;

              switch (msg.messageType) {
                case 'markdown':
                  const markdownPayload = msg.payload as MarkdownPayload;
                  if (markdownPayload.content) {
                    appendToLastAssistantMessage(activeSessionId, markdownPayload.content);
                    updateStreamingMessage(markdownPayload.content);
                  }
                  break;

                case 'ui':
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

                case 'meta':
                  const metaPayload = msg.payload as MetaPayload;
                  if (metaPayload?.uiStage) {
                    setStage(metaPayload.uiStage);
                  }
                  break;

                case 'progress':
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

                case 'log':
                  const logPayload = msg.payload as LogPayload;
                  // 在控制台输出服务端日志
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

                case 'prompt_suggestion':
                case 'edit_suggestion':
                case 'image_generating':
                case 'image_editing':
                case 'image_result':
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
                  break;

                case 'artifact_created':
                  const artifactCreatedPayload = msg.payload as ArtifactCreatedPayload;
                  if (artifactCreatedPayload?.artifactId) {
                    console.log(`[Artifact Created] ${artifactCreatedPayload.title} (${artifactCreatedPayload.artifactId})`);
                    // 加载并显示产物
                    artifactApi.getArtifact(artifactCreatedPayload.artifactId)
                      .then((response) => {
                        if (response.data) {
                          setActiveArtifact(response.data);
                        }
                      })
                      .catch((error) => {
                        console.error('Failed to load artifact:', error);
                      });
                  }
                  break;

                case 'done':
                  setStreaming(false);
                  clearProgress();
                  {
                    const donePayload = msg.payload as { durationMs?: number } | null;
                    finalizeAIUIStreaming(
                      donePayload && typeof donePayload.durationMs === 'number'
                        ? { durationMs: donePayload.durationMs }
                        : undefined,
                    );
                  }
                  break;

                case 'error': {
                  const errPayload = msg.payload as { error?: string } | null;
                  const errMsg = errPayload?.error || t('unknownError');
                  console.error('服务器返回错误', errMsg);
                  setChatError(errMsg);
                  setStreaming(false);
                  finalizeAIUIStreaming();
                  abortRef.current?.abort();
                  return;
                }
              }
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
        }
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, `\n\n*[${t('requestError')}]*`);
      }
      setStreaming(false);
      finalizeAIUIStreaming();
    }
  };

  const formatUIActionText = (action: string, data: Record<string, unknown>): string => {
    if (action === 'submit') {
      if (data.selectedType) {
        // 选择类型
        const typeLabels: Record<string, string> = {
          new_feature: '新功能需求',
          bug_fix: '缺陷修复',
          optimization: '性能优化',
          refactoring: '代码重构',
        };
        const typeLabel = typeLabels[data.selectedType as string] || data.selectedType;
        return `选择需求类型：${typeLabel}`;
      } else if (data.requirementTitle || data.targetUsers) {
        // 表单提交
        const parts: string[] = [];
        if (data.requirementTitle) {
          parts.push(`需求标题：${data.requirementTitle}`);
        }
        if (data.targetUsers) {
          parts.push(`目标用户：${data.targetUsers}`);
        }
        if (data.businessGoal) {
          parts.push(`业务目标：${data.businessGoal}`);
        }
        if (data.functionalDescription) {
          parts.push(`功能描述：${data.functionalDescription}`);
        }
        return parts.join('\n');
      } else {
        // 通用提交
        return `确认提交`;
      }
    } else if (action === 'cancel') {
      return '取消操作';
    }
    return `执行操作：${action}`;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

      await fetchEventSource(
        `${getApiBaseUrl()}/api/conversations/${activeSessionId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: uiAction,
            modelId: selectedModelId ?? undefined,
          }),
          signal: abortRef.current.signal,

          onmessage(event) {
            // 收到第一个响应，关闭"思考中"状态
            setIsWaitingFirstResponse(false);

            try {
              const msg = JSON.parse(event.data) as StreamMessage;


              switch (msg.messageType) {
                case 'markdown':
                  const markdownPayload = msg.payload as MarkdownPayload;
                  if (markdownPayload.content) {
                    appendToLastAssistantMessage(activeSessionId, markdownPayload.content);
                    updateStreamingMessage(markdownPayload.content);
                  }
                  break;

                case 'ui':
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

                case 'meta':
                  const metaPayload = msg.payload as MetaPayload;
                  if (metaPayload?.uiStage) {
                    setStage(metaPayload.uiStage);
                  }
                  break;

                case 'progress':
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

                case 'log':
                  const logPayload = msg.payload as LogPayload;
                  // 在控制台输出服务端日志
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

                case 'artifact_created':
                  const artifactCreatedPayload = msg.payload as ArtifactCreatedPayload;
                  if (artifactCreatedPayload?.artifactId) {
                    console.log(`[Artifact Created] ${artifactCreatedPayload.title} (${artifactCreatedPayload.artifactId})`);
                    // 加载并显示产物
                    artifactApi.getArtifact(artifactCreatedPayload.artifactId)
                      .then((response) => {
                        if (response.data) {
                          setActiveArtifact(response.data);
                        }
                      })
                      .catch((error) => {
                        console.error('Failed to load artifact:', error);
                      });
                  }
                  break;

                case 'done':
                  setStreaming(false);
                  clearProgress();
                  {
                    const donePayload = msg.payload as { durationMs?: number } | null;
                    finalizeAIUIStreaming(
                      donePayload && typeof donePayload.durationMs === 'number'
                        ? { durationMs: donePayload.durationMs }
                        : undefined,
                    );
                  }
                  break;

                case 'error': {
                  const errPayload = msg.payload as { error?: string } | null;
                  const errMsg = errPayload?.error || t('unknownError');
                  console.error('服务器返回错误（UIAction）', errMsg);
                  setChatError(errMsg);
                  setStreaming(false);
                  setIsWaitingFirstResponse(false);
                  finalizeAIUIStreaming();
                  abortRef.current?.abort();
                  return;
                }
              }
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
        }
      );
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
          <p className="text-sm">{tc('loading')}</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 w-full min-w-0 shrink-0 items-center gap-2 px-3 border-b border-border">
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

  const chatColumn = (
    <div className="relative flex h-full min-w-0 overflow-hidden">
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-12 w-full min-w-0 shrink-0 items-center gap-2 px-3 border-b border-border">
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

        {chatError && (
          <div className="mx-auto w-full max-w-3xl px-6 pt-3">
            <Alert
              variant="destructive"
              className="relative pr-10 border-red-200/70 bg-red-50 dark:border-red-900/50 dark:bg-red-950/50"
            >
              <AlertCircle />
              <AlertTitle>{splitErrorMessage(chatError).title}</AlertTitle>
              <AlertDescription>
                <ErrorMessageBody message={splitErrorMessage(chatError).body} />
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

        <div className="relative flex-1 min-h-0">
          <Conversation className="relative z-0 h-full flex-1 min-w-0 py-8">
            <ConversationContent className="mx-auto w-full min-w-0 max-w-3xl gap-6 px-6">
              {aiUIMessages.length === 0 && !isLocked && activeSessionId && !templateSheetOpen && !activeImageTemplate && (
                <div className="flex flex-col items-center gap-7 py-16">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    您好！我能为您做些什么？
                  </h2>
                  <ModeSwitcher
                    conversationId={activeSessionId}
                    currentKind={activeKind}
                    currentAgentId={activeAgent?.id}
                    onSwitched={refreshResources}
                  />
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
            className={`pointer-events-auto mx-auto w-full min-w-0 max-w-3xl rounded-2xl${templateSheetOpen ? ' border border-white/40 px-3 pb-2 pt-1 shadow-lg shadow-black/5' : ''}`}
            style={templateSheetOpen ? {
              background: 'hsl(0 0% 100% / 0.32)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            } : undefined}
          >
            <ChatPromptInput
              onSend={handleSend}
              isStreaming={isStreaming}
              enableImages={inputKind !== 'video' && (modelSupportsVision || inputKind === 'image')}
              enableVideo={false}
              imageWorkflowActive={inputKind === 'image'}
              headerSlot={inputKind === 'video' && !templateSheetOpen ? (
                <VideoInputArea
                  mode={videoGenMode}
                  materials={videoMaterials}
                  frames={videoFrames}
                  onAddMaterial={(files) => {
                    for (const file of files) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const url = reader.result as string;
                        const type = file.type.startsWith('video/') ? 'video' as const : file.type.startsWith('audio/') ? 'audio' as const : 'image' as const;
                        setVideoMaterials((prev) => [...prev, { id: `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, name: file.name, type }]);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  onRemoveMaterial={(id) => setVideoMaterials((prev) => prev.filter((m) => m.id !== id))}
                  onAddFrame={() => setVideoFrames((prev) => [...prev, { id: `frame-${Date.now()}`, material: null, duration: videoDuration }])}
                  onRemoveFrame={(id) => setVideoFrames((prev) => prev.filter((f) => f.id !== id))}
                  onFrameFileUpload={(frameId, files) => {
                    const file = files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const url = reader.result as string;
                      const type = file.type.startsWith('video/') ? 'video' as const : 'image' as const;
                      const mat = { id: `mat-${Date.now()}`, url, name: file.name, type };
                      setVideoFrames((prev) => prev.map((f) => f.id === frameId ? { ...f, material: mat } : f));
                    };
                    reader.readAsDataURL(file);
                  }}
                  onClearAll={() => setVideoFrames([{ id: 'frame-1', material: null, duration: videoDuration }])}
                />
              ) : undefined}
              onPasteFiles={activeKind === 'video' ? (files) => {
                const file = files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const url = reader.result as string;
                  const type = file.type.startsWith('video/') ? 'video' as const : file.type.startsWith('audio/') ? 'audio' as const : 'image' as const;
                  const mat = { id: `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, name: file.name, type };
                  if (videoGenMode === 'reference') {
                    setVideoMaterials((prev) => [...prev, mat]);
                  } else if (videoGenMode === 'first_last_frame') {
                    setVideoFrames((prev) => {
                      const firstEmpty = prev.findIndex((f) => !f.material);
                      if (firstEmpty >= 0) return prev.map((f, i) => i === firstEmpty ? { ...f, material: mat } : f);
                      return prev.map((f, i) => i === 0 ? { ...f, material: mat } : f);
                    });
                  } else {
                    setVideoFrames((prev) => {
                      const firstEmpty = prev.findIndex((f) => !f.material);
                      if (firstEmpty >= 0) return prev.map((f, i) => i === firstEmpty ? { ...f, material: mat } : f);
                      return [...prev, { id: `frame-${Date.now()}`, material: mat, duration: videoDuration }];
                    });
                  }
                };
                reader.readAsDataURL(file);
                for (let i = 1; i < files.length; i++) {
                  const f = files[i];
                  const r = new FileReader();
                  r.onload = () => {
                    const url2 = r.result as string;
                    const type2 = f.type.startsWith('video/') ? 'video' as const : f.type.startsWith('audio/') ? 'audio' as const : 'image' as const;
                    const mat2 = { id: `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`, url: url2, name: f.name, type: type2 };
                    if (videoGenMode === 'reference') {
                      setVideoMaterials((prev) => [...prev, mat2]);
                    } else {
                      setVideoFrames((prev) => {
                        const firstEmpty = prev.findIndex((fr) => !fr.material);
                        if (firstEmpty >= 0) return prev.map((fr, idx) => idx === firstEmpty ? { ...fr, material: mat2 } : fr);
                        return [...prev, { id: `frame-${Date.now()}-${i}`, material: mat2, duration: videoDuration }];
                      });
                    }
                  };
                  r.readAsDataURL(f);
                }
              } : undefined}
              selectedSourceImages={selectedSourceImages}
              onGenerateImage={(instruction, images) => handleGenerateImage({
                ...(selectedSourceImages.length > 0
                  ? { editInstruction: instruction, sourceImages: selectedSourceImages }
                  : { promptOverride: instruction }),
                inputImages: images,
              })}
              onRemoveSourceImage={(index) =>
                setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index))
              }
              onClearSourceImages={() => setSelectedSourceImages([])}
              activeTemplate={imageTemplateResource ? {
                id: activeImageTemplate?.resourceId ?? '',
                title: imageTemplateResource?.title ?? '',
                coverImage: imageTemplateResource?.coverImage,
                variableCount: (imageTemplateResource?.variables ?? []).length,
              } : undefined}
              onOpenTemplateEditor={() => setPromptDialogOpen(true)}
              onReuseTemplate={imageTemplateResource ? () => {
                const composed = composeTemplatePrompt(
                  imageTemplateResource?.prompt ?? '',
                  templateVariables,
                );
                setPromptInject((prev) => ({
                  content: composed,
                  images: selectedRefImages,
                  token: (prev?.token ?? 0) + 1,
                }));
              } : undefined}
              injectValue={promptInject ?? undefined}
              glassEffect={templateSheetOpen}
              onRemoveTemplate={() => {
                if (activeImageTemplate?.resourceId && activeSessionId) {
                  conversationResourcesApi.detach(
                    activeSessionId,
                    'IMAGE_TEMPLATE' as any,
                    activeImageTemplate.resourceId,
                  ).then(() => {
                    window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
                  });
                }
              }}
            />
            {activeKind === 'video' ? (
              <VideoToolbar
                model={videoModel}
                onModelChange={setVideoModel}
                mode={videoGenMode}
                onModeChange={setVideoGenMode}
                ratio={videoRatio}
                onRatioChange={setVideoRatio}
                duration={videoDuration}
                onDurationChange={setVideoDuration}
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
                    recent: t('modelPicker.recent'),
                    empty: t('modelPicker.empty'),
                    clearSelection: t('modelPicker.clearSelection'),
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
          setPromptInject((prev) => ({
            content: composed,
            images: refs,
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
        currentTemplateId={activeKind === 'video' ? activeVideoTemplate?.resourceId : activeImageTemplate?.resourceId}
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
