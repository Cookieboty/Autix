'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useChatStore } from '@/store/chat.store';
import { useAIUIStore } from '@/store/ai-ui.store';
import { MessageSquare, Globe, ChevronDown } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { AIUIRenderer } from '@/components/ai-ui';
import { UIAction } from '@/types/ai-ui';

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

function parseSseLine(line: string): { type: 'text' | 'ui-event' | 'summary' | 'done' | 'error' | 'unknown', data?: any, text?: string } | null {
  if (!line.startsWith('data: ')) return null;
  const value = line.slice(6);
  if (value === '[DONE]') return { type: 'done' };
  if (value === '[ERROR]') return { type: 'error' };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'summary') return { type: 'summary', data: parsed };
      if (parsed.type === 'ui-event') return { type: 'ui-event', data: parsed };
    }
    return { type: 'text', text: value };
  } catch {
    return { type: 'text', text: value };
  }
}

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
        title="去配置模型"
      >
        <Globe className="w-4 h-4" />
        <span>暂无模型，点击配置</span>
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
        <span>{selected?.name ?? '选择模型'}</span>
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
                  {visibility === 'private' ? '私人模型' : '公开模型'}
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
                            默认
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

interface ChatViewProps {
  /** 如果由 URL 参数提供，则直接激活该会话 */
  sessionId?: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
  const router = useRouter();
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
    isWaitingForUser,
    addMessage: addAIUIMessage,
    updateStreamingMessage,
    finalizeStreaming: finalizeAIUIStreaming,
    setStage,
    reset: resetAIUI,
    clearMessages,
  } = useAIUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [lastAssistantUIResponse, setLastAssistantUIResponse] = useState<any>(null);

  const activeSession = getActiveSession();

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
          const id = await createSession('新对话');
          router.replace(`/c/${id}`);
        }
      }
    };
    init();
  }, [sessionId]);

  // 同步历史消息到 AI UI Store
  useEffect(() => {
    if (activeSession?.messages && activeSession.messages.length > 0) {
      clearMessages();
      
      activeSession.messages.forEach((msg: any, idx: number) => {
        const aiMsg: any = {
          id: msg.id,
          role: msg.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.createdAt),
        };
        
        // 如果消息有 UI 数据,添加到 AI UI 消息中
        if (msg.metadata?.uiResponse) {
          aiMsg.uiResponse = msg.metadata.uiResponse;
        }
        if (msg.metadata?.uiStage) {
          aiMsg.uiStage = msg.metadata.uiStage;
        }
        
        addAIUIMessage(aiMsg);
      });
    }
  }, [activeSession?.id, activeSession?.messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) return;

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

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const response = await fetch(
        `${CHAT_API_URL}/api/conversations/${activeSessionId}/chat`,
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
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = parseSseLine(line.trim());
            if (event) {
              switch (event.type) {
                case 'text':
                  if (event.text) {
                    appendToLastAssistantMessage(activeSessionId, event.text + '\n');
                    updateStreamingMessage(event.text + '\n');
                  }
                  break;
                case 'ui-event':
                  if (event.data) {
                    setLastAssistantUIResponse(event.data);
                    updateStreamingMessage('', event.data);
                  }
                  break;
                case 'summary':
                  if (event.data?.uiStage) {
                    setStage(event.data.uiStage);
                  }
                  break;
                case 'done':
                  finalizeAIUIStreaming();
                  break;
                case 'error':
                  throw new Error('服务器返回错误');
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, '\n\n*[请求出错，请重试]*');
      }
    } finally {
      setStreaming(false);
      finalizeAIUIStreaming();
    }
  };

  const handleUIAction = async (componentId: string, action: string, data: Record<string, unknown>) => {
    if (!activeSessionId) return;

    const uiAction: UIAction = {
      componentId,
      action: action as 'submit' | 'cancel' | 'custom',
      data,
      timestamp: new Date().toISOString(),
    };

    addMessage(activeSessionId, {
      role: 'user',
      content: `[UI 操作: ${action}]`,
      timestamp: new Date().toISOString(),
    });

    addAIUIMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: `[操作: ${action}]`,
      timestamp: new Date(),
    });

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const response = await fetch(
        `${CHAT_API_URL}/api/conversations/${activeSessionId}/chat`,
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
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = parseSseLine(line.trim());
            if (event) {
              switch (event.type) {
                case 'text':
                  if (event.text) {
                    appendToLastAssistantMessage(activeSessionId, event.text + '\n');
                    updateStreamingMessage(event.text + '\n');
                  }
                  break;
                case 'ui-event':
                  if (event.data) {
                    setLastAssistantUIResponse(event.data);
                    updateStreamingMessage('', event.data);
                  }
                  break;
                case 'summary':
                  if (event.data?.uiStage) {
                    setStage(event.data.uiStage);
                  }
                  break;
                case 'done':
                  finalizeAIUIStreaming();
                  break;
                case 'error':
                  throw new Error('服务器返回错误');
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, '\n\n*[请求出错，请重试]*');
      }
    } finally {
      setStreaming(false);
      finalizeAIUIStreaming();
    }
  };

  if (isLoadingSessions) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">选择或创建一个对话开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div
        className="flex items-center flex-shrink-0 h-14"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-full max-w-3xl mx-auto px-8">
          <ModelSelector />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-8">
        <div className="max-w-3xl mx-auto px-8 space-y-8">
          {aiUIMessages.length === 0 && (
            <MessageBubble
              role="assistant"
              content={`您好！我是 Autix AI 需求分析助理。\n请描述您的需求，我来帮您进行结构化分析与整理。`}
            />
          )}

          {aiUIMessages.map((msg, i) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[70%]">
                  <MessageBubble
                    role="user"
                    content={msg.content}
                  />
                </div>
              ) : (
                <div className="w-full max-w-full space-y-3">
                  {msg.content && (
                    <MessageBubble
                      role="assistant"
                      content={msg.content}
                      isStreaming={msg.isStreaming && !msg.uiResponse}
                    />
                  )}
                  {msg.uiResponse && (
                    <div className="w-full">
                      <AIUIRenderer
                        components={msg.uiResponse.messages}
                        onAction={handleUIAction}
                        disabled={isStreaming || (isWaitingForUser && i !== aiUIMessages.length - 1)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pb-5 pt-3">
        <div className="max-w-3xl mx-auto px-8">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}
