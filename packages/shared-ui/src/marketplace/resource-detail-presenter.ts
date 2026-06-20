import type {
  ConversationKind,
  ImageTemplate,
  ResourceType,
  TemplateVariable,
  VideoTemplate,
} from '@autix/shared-store';
import type { ResourceDetailItem } from './resource-detail-types';

export function hasTemplatePrompt(
  resource: ResourceDetailItem,
): resource is (ImageTemplate | VideoTemplate) & {
  prompt: string;
  variables: TemplateVariable[];
} {
  return 'prompt' in resource && typeof resource.prompt === 'string';
}

export function conversationKindLabel(
  kind: ConversationKind,
  labels: Record<ConversationKind, string>,
) {
  switch (kind) {
    case 'video':
      return labels.video;
    case 'image':
      return labels.image;
    case 'avatar':
      return labels.avatar;
    case 'chat':
    default:
      return labels.chat;
  }
}

export function templateCompatibleTargetLabel(
  type: ResourceType,
  labels: { imageTemplate: string; videoTemplate: string; defaultTarget: string },
) {
  if (type === 'IMAGE_TEMPLATE') return labels.imageTemplate;
  if (type === 'VIDEO_TEMPLATE') return labels.videoTemplate;
  return labels.defaultTarget;
}

export function isTemplateSessionCompatible(type: ResourceType, kind: ConversationKind) {
  if (type === 'IMAGE_TEMPLATE') return kind === 'chat' || kind === 'image';
  if (type === 'VIDEO_TEMPLATE') return kind === 'chat';
  return true;
}

export function templateSessionMismatchMessage(
  type: ResourceType,
  kind: ConversationKind,
  labels: {
    conversationKinds: Record<ConversationKind, string>;
    compatibleTargets: {
      imageTemplate: string;
      videoTemplate: string;
      defaultTarget: string;
    };
    templateSessionMismatch: string;
  },
) {
  const current = conversationKindLabel(kind, labels.conversationKinds);
  const target = templateCompatibleTargetLabel(type, labels.compatibleTargets);
  return labels.templateSessionMismatch
    .replace('{current}', current)
    .replace('{target}', target);
}
