'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  getAttachmentKind,
  isSupportedChatAttachment,
  type ChatAttachmentInput,
  type LocalChatAttachment,
} from '../chat-attachments';
import type { ChatPromptInjectValue } from './types';

export const MAX_ATTACHMENTS = 9;

export function revokeLocalAttachment(attachment: LocalChatAttachment) {
  if (attachment.file && attachment.url.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.url);
  }
}

export function createInjectedAttachments(
  injectValue: ChatPromptInjectValue,
): LocalChatAttachment[] {
  const injectedAttachments: ChatAttachmentInput[] = [
    ...(injectValue.attachments ?? []),
    ...(injectValue.images ?? []).map((url, index) => ({
      url,
      name: `image-${index + 1}`,
      mimeType: 'image/png',
      size: 0,
    })),
  ];

  return injectedAttachments.slice(0, MAX_ATTACHMENTS).map((attachment, index) => ({
    ...attachment,
    id: `injected-${injectValue.token}-${index}`,
    kind: getAttachmentKind(attachment.mimeType),
  }));
}

interface UseChatPromptAttachmentsOptions {
  enableVideo: boolean;
  onPasteFiles?: (files: File[]) => void;
}

export function useChatPromptAttachments({
  enableVideo,
  onPasteFiles,
}: UseChatPromptAttachmentsOptions) {
  const [attachments, setAttachments] = useState<LocalChatAttachment[]>([]);
  const attachmentsRef = useRef<LocalChatAttachment[]>([]);
  const t = useTranslations('chat');

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach(revokeLocalAttachment);
      return [];
    });
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach(revokeLocalAttachment);
  }, []);

  const addAttachmentsFromFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const fileArray = incoming.filter(isSupportedChatAttachment);
      if (fileArray.length === 0) {
        toast.warning(t('attachments.unsupportedType'));
        return;
      }

      const remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        toast.warning(t('attachments.maxReached', { max: MAX_ATTACHMENTS }));
        return;
      }
      const toProcess = fileArray.slice(0, remaining);
      if (fileArray.length > remaining) {
        toast.warning(t('attachments.maxRemaining', { remaining }));
      }

      const next: LocalChatAttachment[] = toProcess.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: file.type.startsWith('image/') || file.type.startsWith('video/')
          ? URL.createObjectURL(file)
          : '',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        kind: getAttachmentKind(file.type || 'application/octet-stream'),
      }));

      setAttachments((prev) => [...prev, ...next]);
    },
    [attachments.length, t],
  );

  const handlePaste = useCallback(
    (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const file = item.getAsFile();
        if (file && isSupportedChatAttachment(file)) files.push(file);
      }

      if (files.length > 0) {
        e.preventDefault();
        const allMedia = files.every((file) =>
          file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'),
        );
        if (onPasteFiles && enableVideo && allMedia) {
          onPasteFiles(files);
        } else {
          addAttachmentsFromFiles(files);
        }
      }
    },
    [enableVideo, addAttachmentsFromFiles, onPasteFiles],
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) revokeLocalAttachment(target);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return {
    attachments,
    setAttachments,
    clearAttachments,
    addAttachmentsFromFiles,
    handlePaste,
    removeAttachment,
  };
}
