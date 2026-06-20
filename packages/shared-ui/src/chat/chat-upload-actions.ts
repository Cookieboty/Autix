import {
  uploadBase64ImageToStorage,
  uploadFileToStorage,
  type ChatAttachment,
} from '@autix/shared-store';
import {
  normalizeChatAttachments,
  type LocalChatAttachment,
} from './chat-attachments';

type Base64ImageUploader = typeof uploadBase64ImageToStorage;
type FileUploader = typeof uploadFileToStorage;

export async function uploadChatImages(
  images: string[] | undefined,
  options: {
    missingPublicUrlMessage: string;
    uploadBase64Image?: Base64ImageUploader;
  },
): Promise<string[]> {
  if (!images?.length) return [];

  const uploadBase64Image = options.uploadBase64Image ?? uploadBase64ImageToStorage;
  const uploaded: string[] = [];

  for (const image of images) {
    if (!image.startsWith('data:')) {
      uploaded.push(image);
      continue;
    }

    const uploadedImage = await uploadBase64Image(image, {
      folder: 'amux-studio/chat-uploads',
    });
    const publicUrl =
      typeof uploadedImage.publicUrl === 'string' ? uploadedImage.publicUrl : '';

    if (!publicUrl) {
      throw new Error(options.missingPublicUrlMessage);
    }

    uploaded.push(publicUrl);
  }

  return uploaded;
}

export async function uploadChatAttachments(
  attachments: LocalChatAttachment[] | undefined,
  options: { uploadFile?: FileUploader } = {},
): Promise<ChatAttachment[]> {
  if (!attachments?.length) return [];

  const uploadFile = options.uploadFile ?? uploadFileToStorage;
  const uploaded: ChatAttachment[] = [];

  for (const attachment of attachments) {
    if (!attachment.file) {
      uploaded.push(...normalizeChatAttachments([attachment]));
      continue;
    }

    const uploadedFile = await uploadFile(attachment.file, {
      contentType: attachment.mimeType,
      folder: 'amux-studio/chat-attachments',
    });

    uploaded.push({
      url: uploadedFile.publicUrl,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
    });
  }

  return uploaded;
}
