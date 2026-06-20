import {
  uploadFileToStorage,
  type ChatAttachment,
  type ConversationKind,
  type ResourceType,
  type TemplateVariable,
} from '@autix/shared-store';
import {
  normalizeChatAttachments,
  type LocalChatAttachment,
} from '../chat/chat-attachments';
import type { FrameSlot, VideoMaterial } from '../video/VideoInputArea';
import type { VideoGenMode } from '../video/VideoToolbar';
import type { TemplateWithPrompt } from './marketplace-chat-dock-types';

export function materialToAttachment(
  material: VideoMaterial,
  index: number,
): LocalChatAttachment {
  const mimeType =
    material.type === 'video'
      ? 'video/mp4'
      : material.type === 'audio'
        ? 'audio/mpeg'
        : 'image/jpeg';
  return {
    id: `video-material-${material.id}-${index}`,
    url: material.url,
    name: material.name ?? `video-material-${index + 1}`,
    mimeType,
    size: 0,
    kind: material.type,
  };
}

export function uniqueRefs(refs: Array<{ url: string }>): Array<{ url: string }> {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (!ref.url || seen.has(ref.url)) return false;
    seen.add(ref.url);
    return true;
  });
}

export async function uploadDockAttachments(
  attachments?: LocalChatAttachment[],
): Promise<ChatAttachment[]> {
  if (!attachments?.length) return [];

  const uploaded: ChatAttachment[] = [];
  for (const attachment of attachments) {
    if (!attachment.file) {
      uploaded.push(...normalizeChatAttachments([attachment]));
      continue;
    }

    const { publicUrl } = await uploadFileToStorage(attachment.file, {
      contentType: attachment.mimeType,
      folder: 'amux-studio/chat-attachments',
    });

    uploaded.push({
      url: publicUrl,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
    });
  }

  return uploaded;
}

export function getTemplateVariables(
  template: TemplateWithPrompt | null,
): TemplateVariable[] {
  return (template?.variables as TemplateVariable[] | undefined) ?? [];
}

export function getTemplateReferenceImages(
  template: TemplateWithPrompt | null,
  isVideoTemplate: boolean,
) {
  if (!template) return [];
  if (isVideoTemplate) return [...new Set(template.exampleMedia ?? [])];
  const refs = [
    ...(template.coverImage ? [template.coverImage] : []),
    ...(template.exampleImages ?? []),
  ];
  return [...new Set(refs)];
}

export function getTemplateDefaults(variables: TemplateVariable[]) {
  const defaults: Record<string, string> = {};
  for (const variable of variables) {
    defaults[variable.key] = variable.default ?? '';
  }
  return defaults;
}

export function getTemplateConversationKind(
  resourceType: ResourceType,
): ConversationKind {
  return resourceType === 'IMAGE_TEMPLATE'
    ? 'image'
    : resourceType === 'VIDEO_TEMPLATE'
      ? 'video'
      : 'chat';
}

export function getInitialVideoMode(
  template: TemplateWithPrompt | null,
): VideoGenMode {
  return (template?.defaultParams?.mode ?? 'reference') as VideoGenMode;
}

export function getVideoContextAttachments({
  mode,
  materials,
  frames,
}: {
  mode: VideoGenMode;
  materials: VideoMaterial[];
  frames: FrameSlot[];
}) {
  return (
    mode === 'reference'
      ? materials
      : frames
        .map((frame) => frame.material)
        .filter((item): item is VideoMaterial => Boolean(item))
  ).map(materialToAttachment);
}
