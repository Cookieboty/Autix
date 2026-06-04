'use client';

import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getConversationDetail, type ConversationDetail } from '@autix/shared-lib';
import { ChatView } from '@/components/chat/ChatView';

const VideoProjectWorkspace = dynamic(
  () => import('@autix/shared-ui/video').then((m) => ({ default: m.VideoProjectWorkspace })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载中…
      </div>
    ),
  },
);

interface Props {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params);
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    if (!id) return;
    setLoading(true);
    setError(null);
    getConversationDetail(id)
      .then((r) => {
        if (alive) setData(r.data);
      })
      .catch((e) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载会话中…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        会话加载失败
      </div>
    );
  }

  switch (data.kind) {
    case 'video':
      return <VideoProjectWorkspace conversationId={data.id} />;
    case 'image':
    case 'avatar':
      return <ChatView sessionId={id} />;
    case 'chat':
    default:
      return <ChatView sessionId={id} />;
  }
}
