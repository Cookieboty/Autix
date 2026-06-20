'use client';

import type { AgentKind } from '@autix/shared-store';
import { ConversationImagesPanel } from './ConversationImagesPanel';
import { TemplatePickerDrawer } from './TemplatePickerDrawer';
import { ResourcePanel } from '../marketplace/ResourcePanel';

export function ChatSidePanels({
  conversationId,
  mode,
  generatedImagesCount,
  templateSheetOpen,
  onTemplateSheetOpenChange,
  activeKind,
  currentTemplateId,
  onTemplateSelected,
}: {
  conversationId?: string;
  mode: 'electron' | 'web';
  generatedImagesCount: number;
  templateSheetOpen: boolean;
  onTemplateSheetOpenChange: (open: boolean) => void;
  activeKind: AgentKind;
  currentTemplateId?: string;
  onTemplateSelected: () => void;
}) {
  return (
    <>
      <ResourcePanel
        conversationId={conversationId}
        mode={mode}
      />

      {conversationId && (
        <ConversationImagesPanel
          conversationId={conversationId}
          refreshToken={generatedImagesCount}
        />
      )}

      <TemplatePickerDrawer
        open={templateSheetOpen}
        onOpenChange={onTemplateSheetOpenChange}
        kind={activeKind}
        conversationId={conversationId ?? ''}
        currentTemplateId={currentTemplateId}
        onSelected={onTemplateSelected}
      />
    </>
  );
}
