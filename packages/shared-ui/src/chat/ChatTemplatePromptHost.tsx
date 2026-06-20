'use client';

import type { AgentKind, TemplateVariable, VideoTemplate } from '@autix/shared-store';
import { TemplatePromptDialog } from './TemplatePromptDialog';

interface ImageTemplateLike {
  title?: string;
  prompt?: string;
  variables?: TemplateVariable[];
  coverImage?: string;
  exampleImages?: string[];
}

export function ChatTemplatePromptHost({
  open,
  onOpenChange,
  activeKind,
  videoTemplate,
  imageTemplate,
  initialValues,
  initialSelectedRefs,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKind: AgentKind;
  videoTemplate?: VideoTemplate;
  imageTemplate?: ImageTemplateLike;
  initialValues: Record<string, string>;
  initialSelectedRefs: string[];
  onApply: (composed: string, values: Record<string, string>, refs: string[]) => void;
}) {
  const templateName =
    activeKind === 'video'
      ? (videoTemplate?.title ?? '')
      : (imageTemplate?.title ?? '');
  const templatePrompt =
    activeKind === 'video'
      ? (videoTemplate?.prompt ?? '')
      : (imageTemplate?.prompt ?? '');
  const variables =
    activeKind === 'video'
      ? (videoTemplate?.variables ?? [])
      : (imageTemplate?.variables ?? []);
  const referenceImages =
    activeKind === 'video'
      ? (videoTemplate?.exampleMedia ?? [])
      : resolveImageTemplateReferences(imageTemplate);

  return (
    <TemplatePromptDialog
      open={open}
      onOpenChange={onOpenChange}
      templateName={templateName}
      templatePrompt={templatePrompt}
      variables={variables}
      referenceImages={referenceImages}
      initialValues={initialValues}
      initialSelectedRefs={initialSelectedRefs}
      onApply={onApply}
    />
  );
}

function resolveImageTemplateReferences(template?: ImageTemplateLike) {
  const cover = template?.coverImage;
  const examples = template?.exampleImages ?? [];
  const all = cover ? [cover, ...examples] : examples;
  return [...new Set(all)];
}
