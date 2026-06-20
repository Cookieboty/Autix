'use client';

import { useCallback, type RefObject } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ArtifactCreatedPayload,
  LogPayload,
  MarkdownPayload,
  MetaPayload,
  ProgressPayload,
  StreamMessage,
  UIPayload,
} from '@autix/shared-store';
import type { SourceImageRef } from './chat-source-images';

type ChatStreamMessageOptions = {
  includeImageMessages?: boolean;
  errorLogLabel?: string;
  clearWaitingOnError?: boolean;
};

export function useChatStreamMessageHandler({
  abortRef,
  addAIUIMessage,
  appendToLastAssistantMessage,
  clearProgress,
  finalizeAIUIStreaming,
  loadArtifactById,
  setChatError,
  setIsWaitingFirstResponse,
  setProgress,
  setSelectedSourceImages,
  setStage,
  setStreaming,
  unknownErrorMessage,
  updateStreamingMessage,
}: {
  abortRef: RefObject<AbortController | null>;
  addAIUIMessage: (message: any) => void;
  appendToLastAssistantMessage: (conversationId: string, content: string) => void;
  clearProgress: () => void;
  finalizeAIUIStreaming: (metadata?: { durationMs: number }) => void;
  loadArtifactById: (artifactId: string) => Promise<unknown>;
  setChatError: (error: string | null) => void;
  setIsWaitingFirstResponse: (waiting: boolean) => void;
  setProgress: (progress: {
    stepKey: string;
    displayName: string;
    index: number;
    total: number;
    status: ProgressPayload['status'];
  }) => void;
  setSelectedSourceImages: Dispatch<SetStateAction<SourceImageRef[]>>;
  setStage: (stage: NonNullable<MetaPayload['uiStage']> | null) => void;
  setStreaming: (streaming: boolean) => void;
  unknownErrorMessage: string;
  updateStreamingMessage: (content: string, uiResponse?: any) => void;
}) {
  return useCallback((
    conversationId: string,
    msg: StreamMessage,
    options: ChatStreamMessageOptions = {},
  ) => {
    switch (msg.messageType) {
      case 'markdown': {
        const markdownPayload = msg.payload as MarkdownPayload;
        if (markdownPayload.content) {
          appendToLastAssistantMessage(conversationId, markdownPayload.content);
          updateStreamingMessage(markdownPayload.content);
        }
        break;
      }

      case 'ui': {
        const uiPayload = msg.payload as UIPayload;
        if (uiPayload) {
          updateStreamingMessage('', {
            messages: uiPayload.components,
            thinking: uiPayload.thinking,
          });
        }
        break;
      }

      case 'meta': {
        const metaPayload = msg.payload as MetaPayload;
        if (metaPayload?.uiStage) {
          setStage(metaPayload.uiStage);
        }
        break;
      }

      case 'progress': {
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
      }

      case 'log': {
        const logPayload = msg.payload as LogPayload;
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
      }

      case 'prompt_suggestion':
      case 'edit_suggestion':
      case 'image_generating':
      case 'image_editing':
      case 'image_result':
        if (options.includeImageMessages) {
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
        }
        break;

      case 'artifact_created': {
        const artifactCreatedPayload = msg.payload as ArtifactCreatedPayload;
        if (artifactCreatedPayload?.artifactId) {
          console.log(`[Artifact Created] ${artifactCreatedPayload.title} (${artifactCreatedPayload.artifactId})`);
          loadArtifactById(artifactCreatedPayload.artifactId)
            .catch((error) => {
              console.error('Failed to load artifact:', error);
            });
        }
        break;
      }

      case 'done': {
        setStreaming(false);
        clearProgress();
        const donePayload = msg.payload as { durationMs?: number } | null;
        finalizeAIUIStreaming(
          donePayload && typeof donePayload.durationMs === 'number'
            ? { durationMs: donePayload.durationMs }
            : undefined,
        );
        break;
      }

      case 'error': {
        const errPayload = msg.payload as { error?: string } | null;
        const errMsg = errPayload?.error || unknownErrorMessage;
        console.error(options.errorLogLabel ?? 'Server returned an error', errMsg);
        setChatError(errMsg);
        setStreaming(false);
        if (options.clearWaitingOnError) setIsWaitingFirstResponse(false);
        finalizeAIUIStreaming();
        abortRef.current?.abort();
        break;
      }
    }
  }, [
    abortRef,
    addAIUIMessage,
    appendToLastAssistantMessage,
    clearProgress,
    finalizeAIUIStreaming,
    loadArtifactById,
    setChatError,
    setIsWaitingFirstResponse,
    setProgress,
    setSelectedSourceImages,
    setStage,
    setStreaming,
    unknownErrorMessage,
    updateStreamingMessage,
  ]);
}
