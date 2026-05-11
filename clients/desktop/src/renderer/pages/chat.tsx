import { useParams } from 'react-router-dom';
import { ChatView } from '@autix/shared-ui/chat';

/**
 * 桌面端 chat 页：sidebar 由 MainLayout 提供（含会话列表）。
 * 这里只渲染主对话区。
 */
export function ChatPage() {
  useParams<{ id?: string }>();
  return <ChatView />;
}
