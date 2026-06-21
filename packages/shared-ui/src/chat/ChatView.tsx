'use client';

import { ChatEmptySessionState } from './ChatEmptySessionState';
import { ChatLoadingState } from './ChatLoadingState';
import { ChatViewShell } from './ChatViewShell';
import { useChatViewController } from './view/useChatViewController';

interface ChatViewProps {
  /** 如果由 URL 参数提供，则直接激活该会话 */
  sessionId?: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
  const controller = useChatViewController({ sessionId });

  if (controller.status === 'loading') {
    return <ChatLoadingState />;
  }

  if (controller.status === 'empty') {
    return <ChatEmptySessionState onToggleSidebar={controller.onToggleSidebar} />;
  }

  return <ChatViewShell {...controller.shellProps} />;
}
