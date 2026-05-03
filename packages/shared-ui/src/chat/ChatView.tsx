'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../navigation';
import { Link } from '../navigation';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useChatStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useResourcePanelStore } from '@autix/shared-store';
import { MessageSquare, Globe, ChevronDown, Sparkles } from 'lucide-react';
import { conversationResourcesApi } from '@autix/shared-lib';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';
import { AIUIRenderer } from '../ai-ui';
import { ArtifactPanel } from '../artifact/ArtifactPanel';
import { ResourcePanel } from '../marketplace/ResourcePanel';
import { ActiveResourcesBar } from './ActiveResourcesBar';
import { useIsElectron } from '../hooks/useIsElectron';
import type { UIAction, StreamMessage, MarkdownPayload, UIPayload, MetaPayload, ProgressPayload, LogPayload, ArtifactCreatedPayload } from '@autix/shared-lib';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { artifactApi, getEnv } from '@autix/shared-lib';
import { useTranslations } from 'next-intl';

function ModelSelector() {
  const router = useRouter();
  const {
    availableModels,
    selectedModelId,
    setSelectedModel,
    fetchAvailableModels,
  } = useChatStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations('chat');

  // 加载可用模型列表
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = availableModels.find((m) => m.id === selectedModelId) ?? availableModels[0];

  if (availableModels.length === 0) {
    return (
      <button
        onClick={() => router.push('/models')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: 'var(--surface)',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
        }}
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: open ? 'var(--surface)' : 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <Globe className="w-4 h-4" style={{ color: 'var(--muted)' }} />
        <span>{selected?.name ?? t('selectModel')}</span>
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform"
          style={{
            color: 'var(--muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-xl py-1 z-50 shadow-lg"
          style={{
            backgroundColor: 'var(--overlay)',
            border: '1px solid var(--border)',
          }}
        >
          {/* 按 private → public 分组展示 */}
          {(['private', 'public'] as const).map((visibility) => {
            const group = availableModels.filter((m) => m.visibility === visibility);
            if (group.length === 0) return null;
            return (
              <div key={visibility}>
                {/* 分组标题 */}
                <div
                  className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}
                >
                  {visibility === 'private' ? t('privateModels') : t('publicModels')}
                </div>
                {group.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setOpen(false);
                    }}
                    className="w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors cursor-pointer"
                    style={{
                      color: selectedModelId === model.id ? 'var(--accent)' : 'var(--foreground)',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{model.name}</span>
                      <div className="flex items-center gap-1">
                        {selectedModelId === model.id && (
                          <span className="text-xs" style={{ color: 'var(--accent)' }}>✓</span>
                        )}
                        {model.isDefault && (
                          <span
                            className="text-[10px] px-1 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                          >
                            {t('default')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      {model.model} · {model.provider}
                    </div>
                  </button>
                ))}
                {/* 组间分隔线 */}
                <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border)' }} />
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: count > 0 ? 'var(--surface)' : 'transparent',
          color: count > 0 ? 'var(--accent)' : 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
        title="本会话激活的资源"
      >
        <Sparkles className="w-4 h-4" />
        <span>已激活 {count}</span>
        <ChevronDown
          className="w-3 h-3"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 rounded-xl py-2 z-50 shadow-lg"
          style={{
            backgroundColor: 'var(--overlay)',
            border: '1px solid var(--border)',
          }}
        >
          {items.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: 'var(--muted)' }}>
              本会话暂无激活的资源。
            </div>
          ) : (
            <>
              <div
                className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                已激活资源
              </div>
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                    {it.resource?.title ?? it.resourceId}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
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
                    className="text-xs px-1 py-0.5 rounded cursor-pointer"
                    style={{ color: 'var(--muted)' }}
                  >
                    移除
                  </button>
                </div>
              ))}
            </>
          )}
          <div
            className="border-t px-3 py-2 flex items-center justify-between gap-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setShowPicker(true)}
              className="text-xs cursor-pointer"
              style={{ color: 'var(--accent)' }}
            >
              + 添加资源
            </button>
            <button
              onClick={() => router.push('/marketplace')}
              className="text-xs cursor-pointer"
              style={{ color: 'var(--muted)' }}
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
        className="w-[420px] rounded-lg p-5 space-y-3"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">添加资源到本会话</h3>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {acquired.length === 0 ? (
            <div
              className="text-xs py-6 text-center"
              style={{ color: 'var(--muted)' }}
            >
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors hover:bg-[var(--panel-muted)]"
                  style={{
                    color: already ? 'var(--muted)' : 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--panel-muted)',
                      color: 'var(--muted)',
                    }}
                  >
                    {it.resourceType}
                  </span>
                  <span className="flex-1 truncate text-left">
                    {it.resource?.title ?? it.resourceId}
                  </span>
                  {already && (
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
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
            className="text-xs px-3 py-1 cursor-pointer"
            style={{ color: 'var(--muted)' }}
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [lastAssistantUIResponse, setLastAssistantUIResponse] = useState<any>(null);
  const [isWaitingFirstResponse, setIsWaitingFirstResponse] = useState(false);

  const activeSession = getActiveSession();

  useEffect(() => {
    setResourcePanelConversationId(activeSessionId ?? undefined);
  }, [activeSessionId, setResourcePanelConversationId]);

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
      const messageType = msg.messageType || msg.metadata?.messageType || (msg.uiResponse || msg.metadata?.uiResponse ? 'ui' : 'markdown');

      const aiMsg: any = {
        id: msg.id,
        role: msg.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
        messageType,
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      };

      // 如果消息有 UI 数据,优先从顶层读取,其次从 metadata 读取
      if (msg.uiResponse || msg.metadata?.uiResponse) {
        aiMsg.uiResponse = msg.uiResponse || msg.metadata.uiResponse;
      }
      if (msg.metadata?.uiStage) {
        aiMsg.uiStage = msg.metadata.uiStage;
      }
      if (msg.metadata?.interactionState) {
        aiMsg.interactionState = msg.metadata.interactionState;
      }

      // 提取 thinking（优先从顶层，其次从 uiResponse，最后从 metadata）
      if (msg.thinking) {
        aiMsg.thinking = msg.thinking;
      } else if (msg.uiResponse?.thinking) {
        aiMsg.thinking = msg.uiResponse.thinking;
      } else if (msg.metadata?.thinking) {
        aiMsg.thinking = msg.metadata.thinking;
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

    // 延迟执行，确保 DOM 已渲染
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 0);
  }, [activeSession?.id, aiUIMessages.length]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) return;
    
    // 防止重复提交：如果正在处理，直接返回
    if (isStreaming) {
      console.warn('[ChatView] 正在处理中，忽略重复请求');
      return;
    }

    // 立即设置 streaming 状态，防止并发调用
    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    addAIUIMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    });

    // 用户消息添加后平滑滚动到底部
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

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
                      agent: progressPayload.agent,
                      agentDisplayName: progressPayload.agentDisplayName,
                      step: progressPayload.step,
                      totalSteps: progressPayload.totalSteps,
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

                case 'error':
                  // 不要抛出异常，会触发重试
                  console.error('服务器返回错误', msg);
                  setStreaming(false);
                  finalizeAIUIStreaming();
                  abortRef.current?.abort();
                  return;
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
                      agent: progressPayload.agent,
                      agentDisplayName: progressPayload.agentDisplayName,
                      step: progressPayload.step,
                      totalSteps: progressPayload.totalSteps,
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

                case 'error':
                  // 不要抛出异常，会触发重试
                  console.error('服务器返回错误（UIAction）');
                  setStreaming(false);
                  setIsWaitingFirstResponse(false);
                  finalizeAIUIStreaming();
                  abortRef.current?.abort();
                  return;
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
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
          <p className="text-sm">{tc('loading')}</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">{t('selectOrCreateChat')}</p>
        </div>
      </div>
    );
  }

  const chatColumn = (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <header
        className="flex h-14 w-full min-w-0 flex-shrink-0 items-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="mx-auto flex w-full min-w-0 max-w-3xl items-center justify-between px-6">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'var(--muted)' }}
          >
            {t('chatWorkspace')}
          </p>
          <div className="flex items-center gap-2">
            <ActiveResourcesBar conversationId={activeSessionId ?? undefined} />
            <ModelSelector />
          </div>
        </div>
      </header>

      <div className="flex-1 min-w-0 overflow-y-auto py-8">
        <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-6">
          {aiUIMessages.length === 0 && (
            <MessageBubble
              role="assistant"
              content={t('welcomeMessage')}
            />
          )}

          {aiUIMessages.map((msg, i) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[78%]">
                  <MessageBubble role="user" content={msg.content || ''} />
                </div>
              ) : msg.messageType === 'ui' ? (
                <div className="w-full">
                  <AIUIRenderer
                    components={msg.uiResponse?.messages || []}
                    thinking={msg.thinking || msg.uiResponse?.thinking || undefined}
                    interactionState={msg.interactionState}
                    onAction={handleUIAction}
                    disabled={isStreaming || (isWaitingForUser && i !== aiUIMessages.length - 1)}
                  />
                </div>
              ) : (
                <div className="w-full max-w-full">
                  <MessageBubble
                    role="assistant"
                    content={msg.content || ''}
                    thinking={msg.thinking || undefined}
                    isStreaming={msg.isStreaming}
                  />
                </div>
              )}
            </div>
          ))}

          {streamingMessage && (
            <div className="flex justify-start">
              {streamingMessage.uiResponse ? (
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
                <div className="w-full max-w-full">
                  <MessageBubble
                    role="assistant"
                    content={streamingMessage.content || ''}
                    thinking={streamingMessage.thinking || undefined}
                    isStreaming={streamingMessage.isStreaming}
                  />
                </div>
              )}
            </div>
          )}

          {isStreaming && !streamingMessage && (
            <ThinkingIndicator progress={currentProgress} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="w-full min-w-0 flex-shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto w-full min-w-0 max-w-3xl">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        </div>
      </div>

      <ResourcePanel
        conversationId={activeSessionId ?? undefined}
        mode={isElectron ? 'electron' : 'web'}
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
