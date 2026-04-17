'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useChatStore } from '@/store/chat.store';
import { useAIUIStore } from '@/store/ai-ui.store';
import { MessageSquare, Globe, ChevronDown } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import { AIUIRenderer } from '@/components/ai-ui';
import type { UIAction, StreamMessage, MarkdownPayload, UIPayload, MetaPayload } from '@/types/ai-ui';
import { fetchEventSource } from '@microsoft/fetch-event-source';

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

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
    streamingMessage,
    isWaitingForUser,
    addMessage: addAIUIMessage,
    setMessages: setAIUIMessages,
    updateStreamingMessage,
    finalizeStreaming: finalizeAIUIStreaming,
    setStage,
    reset: resetAIUI,
    clearMessages,
  } = useAIUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [lastAssistantUIResponse, setLastAssistantUIResponse] = useState<any>(null);
  const [isWaitingFirstResponse, setIsWaitingFirstResponse] = useState(false);

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

    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      
      await fetchEventSource(
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
                  
                case 'done':
                  setStreaming(false);
                  finalizeAIUIStreaming();
                  break;
                  
                case 'error':
                  throw new Error('服务器返回错误');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', parseError);
            }
          },
          
          onerror(err) {
            console.error('SSE connection error:', err);
            setStreaming(false);
            finalizeAIUIStreaming();
            throw err;
          },
          
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
        appendToLastAssistantMessage(activeSessionId, '\n\n*[请求出错，请重试]*');
      }
    } finally {
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

    const userActionText = formatUIActionText(action, data);

    addMessage(activeSessionId, {
      role: 'user',
      content: userActionText,
      timestamp: new Date().toISOString(),
    });

    addAIUIMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userActionText,
      timestamp: new Date(),
    });

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      
      await fetchEventSource(
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
                  
                case 'done':
                  setStreaming(false);
                  finalizeAIUIStreaming();
                  break;
                  
                case 'error':
                  throw new Error('服务器返回错误');
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
            throw err;
          },
          
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
        appendToLastAssistantMessage(activeSessionId, '\n\n*[请求出错，请重试]*');
      }
    } finally {
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
                    content={msg.content || ''}
                  />
                </div>
              ) : (
                msg.messageType === 'ui' ? (
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
                )
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
          
          {/* AI 思考中指示器 */}
          {isWaitingFirstResponse && !streamingMessage && (
            <ThinkingIndicator />
          )}
          
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
