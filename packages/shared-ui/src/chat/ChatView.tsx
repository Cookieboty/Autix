'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../navigation';
import { Link } from '../navigation';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useChatStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useResourcePanelStore } from '@autix/shared-store';
import { MessageSquare, Globe, ChevronDown, PanelLeftIcon, Sparkles, Laugh, AlertCircle, X } from 'lucide-react';
import { appendConversationMessage, conversationResourcesApi, hasChatCapability } from '@autix/shared-lib';
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
import { ActiveResourcesBar } from './ActiveResourcesBar';
import { useIsElectron } from '../hooks/useIsElectron';
import { useOptionalSidebar } from '../ui/sidebar';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '../ui/empty';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { normalizeImageResultItems, type ImageResultItem } from './MessageBubble';
import type { UIAction, StreamMessage, MarkdownPayload, UIPayload, MetaPayload, ProgressPayload, LogPayload, ArtifactCreatedPayload } from '@autix/shared-lib';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { artifactApi, getAvailableModels, getEnv } from '@autix/shared-lib';
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

function FloatingImageStrip({
  images,
  selectedImages,
  onToggle,
}: {
  images: ImageResultItem[];
  selectedImages: SourceImageRef[];
  onToggle: (image: SourceImageRef) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-24 z-20 hidden flex-col items-center gap-2 rounded-full px-2 py-3 md:flex">
      {images.map((image, index) => {
        const selected = selectedImages.some((item) => item.url === image.url);
        return (
          <button
            key={`${image.url}-${index}`}
            type="button"
            className="pointer-events-auto group relative h-10 w-10 origin-right rounded-xl transition-all duration-200 ease-out hover:z-10 hover:h-20 hover:w-20"
            onClick={() => onToggle(image)}
            title="选择为编辑源"
          >
            <img
              src={image.url}
              alt=""
              className={`h-full w-full rounded-xl object-cover shadow-md transition-transform duration-200 ease-out group-hover:scale-110 ${
                selected ? 'border-2 border-primary' : 'border border-border'
              }`}
            />
            {selected && (
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ModelSelector({ imageTemplateActive = false }: { imageTemplateActive?: boolean } = {}) {
  const router = useRouter();
  const {
    availableModels,
    selectedModelId,
    setSelectedModel,
    fetchAvailableModels,
  } = useChatStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('chat');

  useEffect(() => {
    fetchAvailableModels();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const selected = availableModels.find((m) => m.id === selectedModelId) ?? availableModels[0];

  const baseModels = imageTemplateActive
    ? availableModels.filter((m) => hasChatCapability(m.capabilities ?? []))
    : availableModels;

  const filteredModels = search.trim()
    ? baseModels.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.model.toLowerCase().includes(search.toLowerCase()),
      )
    : baseModels;

  if (availableModels.length === 0) {
    return (
      <button
        onClick={() => router.push('/models')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-card text-muted-foreground border border-border"
        title={t('goConfigModels')}
      >
        <Globe className="w-4 h-4" />
        <span>{t('noModelsGoConfig')}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-foreground border border-border hover:bg-card ${
          open ? 'bg-card' : 'bg-transparent'
        }`}
      >
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span>{selected?.name ?? t('selectModel')}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform text-muted-foreground ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-xl py-1 z-50 shadow-lg bg-popover text-popover-foreground border border-border">
          {/* 按 private → public 分组展示 */}
          {(['private', 'public'] as const).map((visibility) => {
            const group = availableModels.filter((m) => m.visibility === visibility);
            if (group.length === 0) return null;
            return (
              <div key={visibility}>
                {/* 分组标题 */}
                <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {visibility === 'private' ? t('privateModels') : t('publicModels')}
                </div>
                {group.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setOpen(false);
                    }}
                    className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors cursor-pointer bg-transparent hover:bg-secondary ${
                      selectedModelId === model.id ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{model.name}</span>
                      <div className="flex items-center gap-1">
                        {selectedModelId === model.id && (
                          <span className="text-xs text-primary">✓</span>
                        )}
                        {model.isDefault && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-primary text-primary-foreground">
                            {t('default')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {model.model} · {model.provider}
                    </div>
                  </button>
                ))}
                {/* 组间分隔线 */}
                <div className="mx-3 my-1 border-t border-border" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivatedResourcesBadge({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [items, setItems] = useState<
    Array<{
      id: string;
      resourceType: string;
      resourceId: string;
      resource?: { title?: string };
    }>
  >([]);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    if (!sessionId) {
      setCount(0);
      setItems([]);
      return;
    }
    try {
      const res = await conversationResourcesApi.list(sessionId);
      const data = (res.data ?? []) as typeof items;
      setItems(data);
      setCount(data.length);
    } catch {
      setItems([]);
      setCount(0);
    }
  };

  useEffect(() => {
    refresh();
  }, [sessionId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!sessionId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          refresh();
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-border ${
          count > 0 ? 'bg-card text-primary' : 'bg-transparent text-foreground'
        }`}
        title="本会话激活的资源"
      >
        <Sparkles className="w-4 h-4" />
        <span>已激活 {count}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-xl py-2 z-50 shadow-lg bg-popover text-popover-foreground border border-border">
          {items.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              本会话暂无激活的资源。
            </div>
          ) : (
            <>
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                已激活资源
              </div>
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="flex-1 truncate text-foreground">
                    {it.resource?.title ?? it.resourceId}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {it.resourceType}
                  </span>
                  <button
                    onClick={async () => {
                      await conversationResourcesApi.detach(
                        sessionId,
                        it.resourceType as 'SKILL',
                        it.resourceId,
                      );
                      refresh();
                    }}
                    className="text-xs px-1 py-0.5 rounded cursor-pointer text-muted-foreground"
                  >
                    移除
                  </button>
                </div>
              ))}
            </>
          )}
          <div className="border-t border-border px-3 py-2 flex items-center justify-between gap-2">
            <button
              onClick={() => setShowPicker(true)}
              className="text-xs cursor-pointer text-primary"
            >
              + 添加资源
            </button>
            <button
              onClick={() => router.push('/marketplace')}
              className="text-xs cursor-pointer text-muted-foreground"
            >
              去市场
            </button>
          </div>
        </div>
      )}
      {showPicker && sessionId && (
        <SessionResourcePicker
          sessionId={sessionId}
          existing={new Set(items.map((it) => `${it.resourceType}:${it.resourceId}`))}
          onClose={() => {
            setShowPicker(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SessionResourcePicker({
  sessionId,
  existing,
  onClose,
}: {
  sessionId: string;
  existing: Set<string>;
  onClose: () => void;
}) {
  const [acquired, setAcquired] = useState<
    Array<{
      resourceType: 'SKILL' | 'AGENT' | 'MCP';
      resourceId: string;
      resource?: { title?: string };
    }>
  >([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@autix/shared-lib').then(({ meApi }) =>
      meApi.resources('acquired').then((res) => {
        if (cancelled) return;
        const all = ((res.data as { items: typeof acquired }).items ?? []).filter(
          (it) => ['SKILL', 'AGENT', 'MCP'].includes(it.resourceType),
        );
        setAcquired(all);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const attach = async (
    resourceType: 'SKILL' | 'AGENT' | 'MCP',
    resourceId: string,
  ) => {
    setBusy(`${resourceType}:${resourceId}`);
    try {
      await conversationResourcesApi.attach(sessionId, resourceType, resourceId);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg p-5 space-y-3 bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">添加资源到本会话</h3>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {acquired.length === 0 ? (
            <div className="text-xs py-6 text-center text-muted-foreground">
              暂无已获取的 Skill / Agent / MCP
            </div>
          ) : (
            acquired.map((it) => {
              const key = `${it.resourceType}:${it.resourceId}`;
              const already = existing.has(key);
              return (
                <button
                  key={key}
                  disabled={already || busy === key}
                  onClick={() => attach(it.resourceType, it.resourceId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors border border-border hover:bg-secondary ${
                    already ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {it.resourceType}
                  </span>
                  <span className="flex-1 truncate text-left">
                    {it.resource?.title ?? it.resourceId}
                  </span>
                  {already && (
                    <span className="text-[10px] text-muted-foreground">
                      已激活
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 cursor-pointer text-muted-foreground"
          >
            完成
          </button>
        </div>
      </div>
    </div>
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
  const [selectedImageModelId, setSelectedImageModelId] = useState<string>('');
  const [imageSize, setImageSize] = useState('auto');
  const [imageQuality, setImageQuality] = useState('auto');
  const [imageCount, setImageCount] = useState(1);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [selectedSourceImages, setSelectedSourceImages] = useState<SourceImageRef[]>([]);
  const [isImageWorkflowRunning, setIsImageWorkflowRunning] = useState(false);
  const imageWorkflowRunningRef = useRef(false);

  const activeSession = getActiveSession();
  const activeImageTemplate = activeResources.find((item) => item.resourceType === 'IMAGE_TEMPLATE');
  const imageTemplateResource = activeImageTemplate?.resource as any | undefined;
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
        uploadResponse = await fetch(`${getEnv().chatApiUrl}/api/storage/upload-base64`, {
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
    const hinted = imageModels.find((m) => m.model === imageTemplateResource.modelHint);
    setSelectedImageModelId(hinted?.id ?? imageModels[0]?.id ?? '');
  }, [imageTemplateResource?.id, imageModels.length]);

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

      const aiMsg: any = {
        id: msg.id,
        role: msg.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
        messageType,
        content: msg.content,
        payload: metadata,
        metadata,
        timestamp: new Date(msg.createdAt ?? msg.timestamp ?? Date.now()),
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

  const resolvedTemplatePrompt = (() => {
    let prompt = imageTemplateResource?.prompt ?? '';
    for (const [key, value] of Object.entries(templateVariables)) {
      prompt = prompt.replaceAll(`{{${key}}}`, value);
    }
    return prompt;
  })();

  const initialAssistantMessage = imageTemplateResource
    ? [
      `已激活图片模板「${imageTemplateResource.title}」。`,
      '',
      '你可以直接描述想要的画面，我会帮你整理成适合生图的提示词；也可以在左侧调整模板变量和生成设置后点击发送。',
      '如果想基于历史图片继续修改，先在图片结果中选择一张或多张图片，再描述要怎么编辑。',
    ].join('\n')
    : t('welcomeMessage');

  const handleGenerateImage = async (payload?: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: SourceImageRef[];
    inputImages?: string[];
  }) => {
    if (
      !activeSessionId ||
      !activeImageTemplate ||
      !selectedImageModelId ||
      isStreaming ||
      imageWorkflowRunningRef.current
    ) {
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
        `${getEnv().chatApiUrl}/api/conversations/${activeSessionId}/generate-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: selectedImageModelId,
            chatModelId: selectedModelId ?? undefined,
            n: imageCount,
            templateId: activeImageTemplate.resourceId,
            variables: templateVariables,
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

    // 防止重复提交：如果正在处理，直接返回
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
        `${getEnv().chatApiUrl}/api/conversations/${activeSessionId}/chat`,
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
                  finalizeAIUIStreaming();
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
        `${getEnv().chatApiUrl}/api/conversations/${activeSessionId}/chat`,
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
                  finalizeAIUIStreaming();
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

  const imageTemplatePanel = imageTemplateResource ? (
    <aside className="w-[280px] shrink-0 overflow-y-auto p-4 space-y-4 border-r border-border bg-card">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          图片模板
        </div>
        <div className="mt-1 text-sm font-medium">{imageTemplateResource.title}</div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">图片模型</label>
        <Select value={selectedImageModelId} onValueChange={setSelectedImageModelId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {imageModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name ?? model.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">生成设置</div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">尺寸 / 比例</span>
          <Select value={imageSize} onValueChange={setImageSize}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem value="1024x1024">1:1 - 1024x1024</SelectItem>
              <SelectItem value="1536x1024">3:2 - 1536x1024</SelectItem>
              <SelectItem value="1024x1536">2:3 - 1024x1536</SelectItem>
              <SelectItem value="1792x1024">16:9 - 1792x1024</SelectItem>
              <SelectItem value="1024x1792">9:16 - 1024x1792</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">画质</span>
          <Select value={imageQuality} onValueChange={setImageQuality}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem value="low">低</SelectItem>
              <SelectItem value="medium">中</SelectItem>
              <SelectItem value="high">高</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">数量</span>
          <Select
            value={String(imageCount)}
            onValueChange={(val) => setImageCount(Number(val))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 张</SelectItem>
              <SelectItem value="2">2 张</SelectItem>
              <SelectItem value="4">4 张</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(imageTemplateResource.variables ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">模板变量</div>
          {(imageTemplateResource.variables ?? []).map((variable: any) => (
            <label key={variable.key} className="block space-y-1">
              <span className="text-[11px] text-muted-foreground">{variable.label ?? variable.key}</span>
              <input
                value={templateVariables[variable.key] ?? ''}
                onChange={(e) => setTemplateVariables((cur) => ({ ...cur, [variable.key]: e.target.value }))}
                className="w-full rounded-md px-2 py-1.5 text-xs bg-background border border-input"
              />
            </label>
          ))}
        </div>
      )}

      <div>
        <div className="mb-1 text-xs text-muted-foreground">当前提示词预览</div>
        <div className="rounded-md p-2 text-xs leading-5 bg-secondary">
          {resolvedTemplatePrompt}
        </div>
      </div>

      {selectedSourceImages.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">编辑源图片</div>
          <div className="grid grid-cols-3 gap-2">
            {selectedSourceImages.map((image, index) => (
              <img key={`${image.url}-${index}`} src={image.url} alt="" className="aspect-square rounded object-cover" />
            ))}
          </div>
        </div>
      )}
    </aside>
  ) : null;

  const chatColumn = (
    <div className="relative flex h-full min-w-0 overflow-hidden">
      {imageTemplatePanel}
      {imageTemplateResource && (
        <FloatingImageStrip
          images={generatedImages}
          selectedImages={selectedSourceImages}
          onToggle={toggleSourceImage}
        />
      )}
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
          <div className="flex flex-1 items-center justify-end gap-2">
            <ActiveResourcesBar conversationId={activeSessionId ?? undefined} />
            <ModelSelector />
          </div>
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

        <Conversation className="flex-1 min-w-0 py-8">
          <ConversationContent className="mx-auto w-full min-w-0 max-w-3xl gap-6 px-6">
            {aiUIMessages.length === 0 && (
              <MessageBubble
                role="assistant"
                content={initialAssistantMessage}
              />
            )}

            {aiUIMessages.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <MessageBubble
                    key={msg.id}
                    role="user"
                    content={msg.content || ''}
                    images={(msg as any).payload?.images ?? (msg as any).metadata?.images ?? []}
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
                  onGenerateImage={handleGenerateImage}
                  onSelectSourceImage={toggleSourceImage}
                />
              );
            })}

            {streamingMessage && (
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
                  onGenerateImage={handleGenerateImage}
                  onSelectSourceImage={toggleSourceImage}
                />
              )
            )}

            {isStreaming && !isImageWorkflowRunning && !streamingMessage && (
              <ThinkingIndicator progress={currentProgress} />
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="w-full min-w-0 flex-shrink-0 px-6 pb-6 pt-2">
          <div className="mx-auto w-full min-w-0 max-w-3xl">
            <ChatPromptInput
              onSend={handleSend}
              isStreaming={isStreaming}
              enableImages={modelSupportsVision || !!imageTemplateResource}
              imageWorkflowActive={!!imageTemplateResource}
              selectedSourceImages={selectedSourceImages}
              onGenerateImage={(instruction, images) => handleGenerateImage({
                editInstruction: instruction,
                inputImages: images,
              })}
              onRemoveSourceImage={(index) =>
                setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index))
              }
              onClearSourceImages={() => setSelectedSourceImages([])}
            />
          </div>
        </div>

        <ResourcePanel
          conversationId={activeSessionId ?? undefined}
          mode={isElectron ? 'electron' : 'web'}
        />
      </div>
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
