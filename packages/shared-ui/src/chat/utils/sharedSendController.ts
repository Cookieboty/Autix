import { fetchEventSource } from '@microsoft/fetch-event-source';
import {
  getApiBaseUrl,
  storageApi,
  type ChatAttachment,
} from '@autix/shared-lib';
import { normalizeChatAttachments, type LocalChatAttachment } from '../chat-attachments';

export interface SendControllerParams {
  conversationId: string;
  content: string;
  attachments?: LocalChatAttachment[];
  modelId?: string;
  sourceImages?: Array<{ url: string; prompt?: string }>;
  signal?: AbortSignal;
}

export interface SendControllerCallbacks {
  onUserMessage: (content: string, metadata?: { images?: string[]; attachments?: ChatAttachment[] }) => void;
  onAssistantPlaceholder: () => void;
  onStreamStart: () => void;
  onMarkdown: (content: string) => void;
  onUI: (payload: unknown) => void;
  onMeta: (payload: unknown) => void;
  onProgress: (payload: unknown) => void;
  onLog: (payload: unknown) => void;
  onImageResult: (payload: unknown) => void;
  onArtifactCreated: (payload: unknown) => void;
  onDone: (payload: { durationMs?: number } | null) => void;
  onError: (error: string) => void;
  onStreamEnd: () => void;
}

async function uploadAttachments(
  attachments?: LocalChatAttachment[],
): Promise<ChatAttachment[]> {
  if (!attachments?.length) return [];

  const uploaded: ChatAttachment[] = [];
  for (const attachment of attachments) {
    if (!attachment.file) {
      uploaded.push(...normalizeChatAttachments([attachment]));
      continue;
    }

    const res = await storageApi.presign({
      fileName: attachment.name,
      contentType: attachment.mimeType,
      folder: 'amux-studio/chat-attachments',
    });

    await fetch(res.data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': attachment.mimeType },
      body: attachment.file,
    });

    uploaded.push({
      url: res.data.publicUrl,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
    });
  }

  return uploaded;
}

function getImageUrls(attachments: ChatAttachment[]): string[] {
  return attachments
    .filter((a) => a.kind === 'image' && a.url)
    .map((a) => a.url);
}

export async function sharedSendController(
  params: SendControllerParams,
  callbacks: SendControllerCallbacks,
): Promise<void> {
  const { conversationId, content, attachments, modelId, sourceImages, signal } = params;

  let uploadedAttachments: ChatAttachment[] = [];
  try {
    uploadedAttachments = await uploadAttachments(attachments);
  } catch (err: any) {
    callbacks.onError(err.message ?? '附件上传失败');
    return;
  }

  const uploadedImages = getImageUrls(uploadedAttachments);
  const userMetadata =
    uploadedImages.length > 0 || uploadedAttachments.length > 0
      ? {
          ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
        }
      : undefined;

  callbacks.onUserMessage(content, userMetadata);
  callbacks.onAssistantPlaceholder();
  callbacks.onStreamStart();

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

    await fetchEventSource(
      `${getApiBaseUrl()}/api/conversations/${conversationId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          modelId: modelId ?? undefined,
          ...(uploadedImages.length ? { images: uploadedImages } : {}),
          ...(uploadedAttachments.length ? { attachments: uploadedAttachments } : {}),
          sourceImages: sourceImages?.length ? sourceImages : undefined,
        }),
        signal,

        onmessage(event) {
          try {
            const msg = JSON.parse(event.data) as { messageType: string; payload: unknown };

            switch (msg.messageType) {
              case 'markdown':
                callbacks.onMarkdown((msg.payload as { content?: string })?.content ?? '');
                break;
              case 'ui':
                callbacks.onUI(msg.payload);
                break;
              case 'meta':
                callbacks.onMeta(msg.payload);
                break;
              case 'progress':
                callbacks.onProgress(msg.payload);
                break;
              case 'log':
                callbacks.onLog(msg.payload);
                break;
              case 'image_result':
              case 'image_generating':
              case 'image_editing':
              case 'prompt_suggestion':
              case 'edit_suggestion':
                callbacks.onImageResult(msg.payload);
                break;
              case 'artifact_created':
                callbacks.onArtifactCreated(msg.payload);
                break;
              case 'done':
                callbacks.onDone(msg.payload as { durationMs?: number } | null);
                callbacks.onStreamEnd();
                break;
              case 'error': {
                const errPayload = msg.payload as { error?: string } | null;
                callbacks.onError(errPayload?.error || '未知错误');
                callbacks.onStreamEnd();
                return;
              }
            }
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        },

        onerror(err) {
          console.error('SSE connection error:', err);
          callbacks.onStreamEnd();
          throw err;
        },

        onclose() {},

        openWhenHidden: false,
      },
    );
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      callbacks.onError(err?.message ?? '发送失败');
    }
    callbacks.onStreamEnd();
  }
}
