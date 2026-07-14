import {
  createTemplateAttachment,
  getChatImageUrls,
  normalizeChatAttachments,
  shouldUseImageGeneration,
} from '../src/chat/chat-attachments';
import {
  uploadChatAttachments,
  uploadChatImages,
} from '../src/chat/chat-upload-actions';

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

  test('uploads data-url images while preserving remote image urls', async () => {
    const uploaded = await uploadChatImages(
      ['https://cdn.example.com/source.png', 'data:image/png;base64,AAAA'],
      {
        missingPublicUrlMessage: 'missing url',
        uploadBase64Image: async (image, options) => {
          expect(image).toBe('data:image/png;base64,AAAA');
          expect(options).toEqual({ folder: 'amux-studio/chat-uploads' });
          return { publicUrl: 'https://cdn.example.com/uploaded.png' };
        },
      },
    );

    expect(uploaded).toEqual([
      'https://cdn.example.com/source.png',
      'https://cdn.example.com/uploaded.png',
    ]);
  });

  test('uploads local attachment files through storage', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const uploaded = await uploadChatAttachments(
      [
        {
          id: 'local',
          url: '',
          name: 'hello.txt',
          mimeType: 'text/plain',
          size: file.size,
          kind: 'file',
          file,
        },
      ],
      {
        uploadFile: async (nextFile, options) => {
          expect(nextFile).toBe(file);
          expect(options).toEqual({
            contentType: 'text/plain',
            folder: 'amux-studio/chat-attachments',
          });
          return {
            uploadUrl: 'https://r2.example.com/upload',
            publicUrl: 'https://cdn.example.com/hello.txt',
            key: 'hello.txt',
          };
        },
      },
    );

    expect(uploaded).toEqual([
      {
        url: 'https://cdn.example.com/hello.txt',
        name: 'hello.txt',
        mimeType: 'text/plain',
        size: file.size,
        kind: 'file',
      },
    ]);
  });
});
