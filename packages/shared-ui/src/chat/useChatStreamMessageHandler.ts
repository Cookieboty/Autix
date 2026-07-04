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
  imageWorkflowRunningRef,
  loadArtifactById,
  reloadSessionMessages,
  setChatError,
  setIsImageWorkflowRunning,
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
  imageWorkflowRunningRef: RefObject<boolean>;
  loadArtifactById: (artifactId: string) => Promise<unknown>;
  reloadSessionMessages: (id: string) => Promise<void>;
  setChatError: (error: string | null) => void;
  setIsImageWorkflowRunning: (running: boolean) => void;
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
          // 生图/改图进行中：标记图片工作流运行中，隐藏通用"正在整理回答"指示器，改为展示"正在生图中"。
          if (msg.messageType === 'image_generating' || msg.messageType === 'image_editing') {
            imageWorkflowRunningRef.current = true;
            setIsImageWorkflowRunning(true);
          }
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
        // 图片流结束：收起"正在生图中"，并从后端强制刷新消息，
        // 让已持久化的图片消息进入本地 store（否则流式图片只存在于临时 aiUIMessages，会被会话对账清掉，需手动刷新才显示）。
        if (imageWorkflowRunningRef.current) {
          imageWorkflowRunningRef.current = false;
          setIsImageWorkflowRunning(false);
          void reloadSessionMessages(conversationId);
        }
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
        if (imageWorkflowRunningRef.current) {
          imageWorkflowRunningRef.current = false;
          setIsImageWorkflowRunning(false);
          // 生图失败：从后端重刷消息，清掉悬挂的"正在生图中"占位卡片。
          void reloadSessionMessages(conversationId);
        }
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
    imageWorkflowRunningRef,
    loadArtifactById,
    reloadSessionMessages,
    setChatError,
    setIsImageWorkflowRunning,
    setIsWaitingFirstResponse,
    setProgress,
    setSelectedSourceImages,
    setStage,
    setStreaming,
    unknownErrorMessage,
    updateStreamingMessage,
  ]);
}
