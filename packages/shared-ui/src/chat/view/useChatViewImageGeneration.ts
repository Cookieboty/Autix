'use client';

import type { RefObject } from 'react';
import {
  conversationActions,
  useAIUIStore,
  type ChatAttachment,
} from '@autix/shared-store';
import { getChatImageUrls, type LocalChatAttachment } from '../chat-attachments';
import type { SourceImageRef } from '../chat-source-images';
import { uploadChatAttachments, uploadChatImages } from '../chat-upload-actions';

interface UseChatViewImageGenerationParams {
  abortRef: RefObject<AbortController | null>;
  activeImageTemplateId?: string;
  activeSessionId: string | null;
  addAIUIMessage: (message: any) => void;
  addMessage: (
    sessionId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    },
  ) => void;
  finalizeAIUIStreaming: (metadata?: { durationMs: number }) => void;
  imageQuality: string;
  imageSize: string;
  imageWorkflowRunningRef: RefObject<boolean>;
  imageUploadFailedMessage: string;
  imageUploadMissingUrlMessage: string;
  isStreaming: boolean;
  messageSaveFailedMessage: string;
  requestErrorMessage: string;
  selectImageTemplateFirstMessage: string;
  selectedChatModelId: string | null;
  selectedModelId: string | null;
  selectedSourceImages: SourceImageRef[];
  setAIUIMessages: (messages: any[]) => void;
  setChatError: (error: string | null) => void;
  setIsImageWorkflowRunning: (running: boolean) => void;
  setIsWaitingFirstResponse: (waiting: boolean) => void;
  setSelectedSourceImages: (images: SourceImageRef[]) => void;
  setStreaming: (streaming: boolean) => void;
  unknownErrorMessage: string;
}

export function useChatViewImageGeneration({
  abortRef,
  activeImageTemplateId,
  activeSessionId,
  addAIUIMessage,
  addMessage,
  finalizeAIUIStreaming,
  imageQuality,
  imageSize,
  imageWorkflowRunningRef,
  imageUploadFailedMessage,
  imageUploadMissingUrlMessage,
  isStreaming,
  messageSaveFailedMessage,
  requestErrorMessage,
  selectImageTemplateFirstMessage,
  selectedChatModelId,
  selectedModelId,
  selectedSourceImages,
  setAIUIMessages,
  setChatError,
  setIsImageWorkflowRunning,
  setIsWaitingFirstResponse,
  setSelectedSourceImages,
  setStreaming,
  unknownErrorMessage,
}: UseChatViewImageGenerationParams) {
  const stopImageWorkflow = () => {
    setStreaming(false);
    setIsImageWorkflowRunning(false);
    imageWorkflowRunningRef.current = false;
  };

  const handleGenerateImage = async (payload?: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: SourceImageRef[];
    inputImages?: string[];
  }) => {
    if (
      !activeSessionId ||
      isStreaming ||
      imageWorkflowRunningRef.current
    ) {
      return;
    }
    if (!activeImageTemplateId) {
      setChatError(selectImageTemplateFirstMessage);
      return;
    }
    const sourceImages = payload?.sourceImages ?? selectedSourceImages;
    const instruction = payload?.editInstruction;

    setStreaming(true);
    setIsImageWorkflowRunning(true);
    imageWorkflowRunningRef.current = true;
    setIsWaitingFirstResponse(true);
    setChatError(null);
    abortRef.current = new AbortController();

    let uploadedInputImages: string[] = [];
    try {
      uploadedInputImages = await uploadChatImages(payload?.inputImages, {
        missingPublicUrlMessage: imageUploadMissingUrlMessage,
      });
    } catch (err: any) {
      setChatError(err.message ?? imageUploadFailedMessage);
      stopImageWorkflow();
      setIsWaitingFirstResponse(false);
      return;
    }
    const referenceImages = uploadedInputImages.map((url) => ({ url }));

    if (instruction || uploadedInputImages.length > 0) {
      const userMetadata = uploadedInputImages.length > 0 ? { images: uploadedInputImages } : undefined;
      try {
        await conversationActions.appendConversationMessage(activeSessionId, {
          role: 'USER',
          content: instruction ?? '',
          metadata: userMetadata,
        });
      } catch (err: any) {
        setChatError(err.message ?? messageSaveFailedMessage);
        stopImageWorkflow();
        setIsWaitingFirstResponse(false);
        return;
      }
      addMessage(activeSessionId, {
        role: 'user',
        content: instruction ?? '',
        timestamp: new Date().toISOString(),
        metadata: userMetadata,
      });
      addAIUIMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: instruction ?? '',
        payload: userMetadata,
        timestamp: new Date(),
      } as any);
    }

    try {
      await conversationActions.streamConversationImageGeneration(activeSessionId, {
        body: {
          model: selectedModelId ?? undefined,
          chatModelId: selectedChatModelId ?? undefined,
          templateId: activeImageTemplateId,
          promptOverride: payload?.promptOverride,
          sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          editInstruction: instruction,
          settings: {
            size: imageSize,
            quality: imageQuality,
          },
        },
        signal: abortRef.current.signal,
        requestErrorMessage,
        onMessage(msg) {
          setIsWaitingFirstResponse(false);

          if (msg.messageType === 'image_generating' || msg.messageType === 'image_editing') {
            const taskId = (msg.payload as any)?.taskId;
            const currentMessages = useAIUIStore.getState().messages;
            const hasProgress = currentMessages.some(
              (item: any) =>
                (item.messageType === 'image_generating' || item.messageType === 'image_editing') &&
                item.payload?.taskId === taskId,
            );
            if (!hasProgress) {
              addAIUIMessage({
                id: `${msg.messageType}-${taskId ?? Date.now()}`,
                role: 'assistant',
                messageType: msg.messageType,
                content: '',
                payload: msg.payload,
                timestamp: new Date(),
              } as any);
            }
          }

          if (msg.messageType === 'image_result') {
            const taskId = (msg.payload as any)?.taskId;
            const currentMessages = useAIUIStore.getState().messages;
            setAIUIMessages([
              ...currentMessages.filter(
                (item: any) =>
                  !(
                    (item.messageType === 'image_generating' || item.messageType === 'image_editing') &&
                    item.payload?.taskId === taskId
                  ),
              ),
              {
                id: `${msg.messageType}-${taskId ?? Date.now()}`,
                role: 'assistant',
                messageType: msg.messageType,
                content: '',
                payload: msg.payload,
                timestamp: new Date(),
              } as any,
            ]);
            setSelectedSourceImages([]);
          }

          if (msg.messageType === 'done') {
            stopImageWorkflow();
            finalizeAIUIStreaming();
          }

          if (msg.messageType === 'error') {
            const errPayload = msg.payload as { error?: string } | null;
            setChatError(errPayload?.error || unknownErrorMessage);
            stopImageWorkflow();
            finalizeAIUIStreaming();
          }
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') setChatError(err.message ?? requestErrorMessage);
      stopImageWorkflow();
      setIsWaitingFirstResponse(false);
      finalizeAIUIStreaming();
    }
  };

  const handleGenerateImageFromInput = async (
    instruction?: string,
    attachments?: LocalChatAttachment[],
  ) => {
    let uploadedAttachments: ChatAttachment[] = [];
    try {
      uploadedAttachments = await uploadChatAttachments(
        attachments?.filter((attachment) => attachment.kind === 'image'),
      );
    } catch (err: any) {
      setChatError(err.message ?? imageUploadFailedMessage);
      return;
    }

    const inputImages = getChatImageUrls(uploadedAttachments);
    return handleGenerateImage({
      ...(selectedSourceImages.length > 0
        ? { editInstruction: instruction, sourceImages: selectedSourceImages }
        : { promptOverride: instruction }),
      inputImages: inputImages.length > 0 ? inputImages : undefined,
    });
  };

  return {
    handleGenerateImage,
    handleGenerateImageFromInput,
  };
}
