'use client';

import { useTranslations } from 'next-intl';
import type { ChatAttachment } from '@autix/shared-store';
import { AIUIRenderer } from '../ai-ui';
import { ThinkingIndicator } from './ThinkingIndicator';
import { MessageBubble, type ImageResultItem } from './MessageBubble';
import type { ChatViewMessage } from './view/chat-view-types';

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isChatAttachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ChatAttachment>;
  return (
    typeof item.url === 'string' &&
    typeof item.name === 'string' &&
    typeof item.mimeType === 'string' &&
    typeof item.size === 'number' &&
    typeof item.kind === 'string'
  );
}

function readChatAttachments(value: unknown): ChatAttachment[] {
  return Array.isArray(value) ? value.filter(isChatAttachment) : [];
}

export function ChatMessageList({
  messages,
  streamingMessage,
  isLocked,
  activeSessionId,
  templateSheetOpen,
  hasActiveModeTemplate,
  isStreaming,
  isWaitingForUser,
  isImageWorkflowRunning,
  currentProgress,
  onUIAction,
  onGenerateImage,
  onSelectSourceImage,
}: {
  messages: ChatViewMessage[];
  streamingMessage: ChatViewMessage | null;
  isLocked: boolean;
  activeSessionId?: string | null;
  templateSheetOpen: boolean;
  hasActiveModeTemplate: boolean;
  isStreaming: boolean;
  isWaitingForUser: boolean;
  isImageWorkflowRunning: boolean;
  currentProgress: {
    stepKey: string;
    displayName: string;
    index: number;
    total: number;
  } | null;
  onUIAction: (componentId: string, action: string, data: Record<string, unknown>) => void;
  onGenerateImage: (payload?: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: Array<{
      url: string;
      prompt?: string;
      generationId?: string;
      index?: number;
    }>;
  }) => void;
  onSelectSourceImage: (image: ImageResultItem) => void;
}) {
  const t = useTranslations('chat');

  return (
    <>
      {messages.length === 0 && !isLocked && activeSessionId && !templateSheetOpen && !hasActiveModeTemplate && (
        <div className="flex flex-col items-center gap-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('emptyGreeting')}
          </h2>
        </div>
      )}

      {messages.map((msg, index) => {
        if (msg.role === 'user') {
          return (
            <MessageBubble
              key={msg.id}
              role="user"
              content={msg.content || ''}
              images={readStringArray(msg.payload?.images ?? msg.metadata?.images)}
              attachments={readChatAttachments(
                msg.payload?.attachments ?? msg.metadata?.attachments,
              )}
              timestamp={msg.timestamp ?? msg.createdAt}
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
                onAction={onUIAction}
                disabled={isStreaming || (isWaitingForUser && index !== messages.length - 1)}
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
            payload={msg.payload}
            timestamp={msg.timestamp ?? msg.createdAt}
            durationMs={msg.durationMs}
            onGenerateImage={onGenerateImage}
            onSelectSourceImage={onSelectSourceImage}
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
                onAction={onUIAction}
                disabled={isStreaming}
              />
            </div>
          ) : (
            <MessageBubble
              role="assistant"
              content={streamingMessage.content || ''}
              thinking={streamingMessage.thinking || undefined}
              isStreaming={streamingMessage.isStreaming}
              messageType={streamingMessage.messageType}
              payload={streamingMessage.payload}
              timestamp={streamingMessage.timestamp}
              durationMs={streamingMessage.durationMs}
              onGenerateImage={onGenerateImage}
              onSelectSourceImage={onSelectSourceImage}
            />
          )
        )}

      {isStreaming &&
        !isImageWorkflowRunning &&
        (!streamingMessage ||
          (!streamingMessage.content && !streamingMessage.uiResponse)) && (
          <ThinkingIndicator progress={currentProgress} />
        )}
    </>
  );
}
