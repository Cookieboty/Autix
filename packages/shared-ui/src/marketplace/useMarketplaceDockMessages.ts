'use client';

import { useCallback, useRef, useState } from 'react';
import type { DockMessage } from './marketplace-chat-dock-types';

export function useMarketplaceDockMessages() {
  const [messages, setMessages] = useState<DockMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  return {
    finishLastAssistantMessage,
    messages,
    messagesEndRef,
    pushMessage,
    replaceAssistantProgress,
    scrollToBottom,
    setMessages,
  };
}
