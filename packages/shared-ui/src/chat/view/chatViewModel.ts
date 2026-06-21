import type { AgentKind, ModelConfigItem } from '@autix/shared-store';
import { normalizeImageResultItems } from '../MessageBubble';
import type { ChatViewMessage } from './chat-view-types';

export type ActiveTemplateSummary = {
  id: string;
  title: string;
  coverImage?: string;
  variableCount: number;
};

type ConversationResourceLinkLike = {
  resourceId?: string;
};

type TemplateResourceLike = {
  title?: string;
  coverImage?: string;
  variables?: unknown[];
};

type ImageResultItem = ReturnType<typeof normalizeImageResultItems>[number];

export function getSelectedVideoModel(
  videoModels: ModelConfigItem[],
  value: string,
) {
  if (!value) return videoModels[0] ?? null;

  return (
    videoModels.find(
      (model) =>
        model.id === value ||
        model.model === value ||
        model.name === value,
    ) ?? videoModels[0] ?? null
  );
}

export function getGeneratedImages(messages: ChatViewMessage[]): ImageResultItem[] {
  return messages.flatMap((message) =>
    message.messageType === 'image_result'
      ? normalizeImageResultItems(
        message.payload?.images,
        message.payload?.prompt,
        message.payload?.generationId,
      )
      : [],
  );
}

export function getActiveTemplateSummary({
  inputKind,
  activeModeTemplate,
  activeModeTemplateResource,
  imageTemplateResource,
}: {
  inputKind: AgentKind;
  activeModeTemplate?: ConversationResourceLinkLike;
  activeModeTemplateResource?: TemplateResourceLike;
  imageTemplateResource?: TemplateResourceLike;
}): ActiveTemplateSummary | undefined {
  if ((inputKind !== 'image' && inputKind !== 'video') || !activeModeTemplateResource) {
    return undefined;
  }

  return {
    id: activeModeTemplate?.resourceId ?? '',
    title: activeModeTemplateResource.title ?? '',
    coverImage: inputKind === 'image' ? imageTemplateResource?.coverImage : undefined,
    variableCount: (activeModeTemplateResource.variables ?? []).length,
  };
}
