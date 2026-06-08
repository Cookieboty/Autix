import { describe, expect, test } from 'bun:test';
import {
  createTemplateAttachment,
  getChatImageUrls,
  normalizeChatAttachments,
  shouldUseImageGeneration,
} from '../src/chat/chat-attachments';

describe('chat attachments', () => {
  test('normalizes uploaded files and exposes only image urls for multimodal chat', () => {
    const attachments = normalizeChatAttachments([
      {
        url: 'https://cdn.example.com/cat.png',
        name: 'cat.png',
        mimeType: 'image/png',
        size: 123,
      },
      {
        url: 'https://cdn.example.com/brief.pdf',
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        size: 456,
      },
      {
        url: '',
        name: 'broken.txt',
        mimeType: 'text/plain',
        size: 1,
      },
    ]);

    expect(attachments).toEqual([
      {
        url: 'https://cdn.example.com/cat.png',
        name: 'cat.png',
        mimeType: 'image/png',
        size: 123,
        kind: 'image',
      },
      {
        url: 'https://cdn.example.com/brief.pdf',
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        size: 456,
        kind: 'file',
      },
    ]);
    expect(getChatImageUrls(attachments)).toEqual(['https://cdn.example.com/cat.png']);
  });

  test('uses image generation only when image mode has an explicit image action', () => {
    expect(shouldUseImageGeneration({ mode: 'image', action: 'chat' })).toBe(false);
    expect(shouldUseImageGeneration({ mode: 'image', action: 'image' })).toBe(true);
    expect(shouldUseImageGeneration({ mode: 'chat', action: 'image' })).toBe(false);
    expect(shouldUseImageGeneration({ mode: 'video', action: 'image' })).toBe(false);
  });

  test('creates template media attachments from image and video urls', () => {
    const image = createTemplateAttachment('https://cdn.example.com/example.webp', 0);
    const video = createTemplateAttachment('https://cdn.example.com/demo.mp4?token=1', 1);
    const attachments = normalizeChatAttachments([image, video]);

    expect(attachments.map((attachment) => attachment.kind)).toEqual(['image', 'video']);
    expect(attachments.map((attachment) => attachment.mimeType)).toEqual(['image/webp', 'video/mp4']);
  });

  test('defaults unknown template media urls to image attachments', () => {
    const media = createTemplateAttachment('https://cdn.example.com/resource/abc123', 0);
    const attachments = normalizeChatAttachments([media]);

    expect(attachments[0]?.kind).toBe('image');
    expect(attachments[0]?.mimeType).toBe('image/jpeg');
  });
});
