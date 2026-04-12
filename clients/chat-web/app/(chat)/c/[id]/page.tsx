'use client';

import { use } from 'react';
import { ChatView } from '@/components/chat/ChatView';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params);
  return <ChatView sessionId={id} />;
}
