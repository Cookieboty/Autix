'use client';

import { useTranslations } from 'next-intl';
import { TemplateWorkspaceMainPanel } from './TemplateWorkspaceMainPanel';
import { TemplateWorkspaceRefineBar } from './TemplateWorkspaceRefineBar';
import { TemplateWorkspaceSidebar } from './TemplateWorkspaceSidebar';
import { useTemplateWorkspaceController } from './useTemplateWorkspaceController';

export interface TemplatesWorkspaceViewProps {
  generationId?: string;
  conversationId?: string | null;
  onBackToDetail: (templateId: string) => void;
  onOpenConversation: (conversationId: string) => void;
}

export function TemplatesWorkspaceView({
  generationId,
  conversationId = null,
  onBackToDetail,
  onOpenConversation,
}: TemplatesWorkspaceViewProps) {
  const tCommon = useTranslations('common');
  const workspace = useTemplateWorkspaceController({
    generationId,
    conversationId,
    onOpenConversation,
  });

  if (!workspace.gen) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {tCommon('loading')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <TemplateWorkspaceSidebar
        generation={workspace.gen}
        currentModel={workspace.currentModel}
        modelOptions={workspace.modelOptions}
        modelInput={workspace.modelInput}
        editingModel={workspace.editingModel}
        showModelDropdown={workspace.showModelDropdown}
        currentPrompt={workspace.currentPrompt}
        promptInput={workspace.promptInput}
        editingPrompt={workspace.editingPrompt}
        templateVariables={workspace.templateVarDefs}
        variableValues={workspace.variableValues}
        onBackToDetail={onBackToDetail}
        onModelInputChange={workspace.setModelInput}
        onEditingModelChange={workspace.setEditingModel}
        onShowModelDropdownChange={workspace.setShowModelDropdown}
        onModelSelect={workspace.handleModelSelect}
        onPromptInputChange={workspace.setPromptInput}
        onEditingPromptChange={workspace.setEditingPrompt}
        onPromptSave={workspace.handlePromptSave}
        onVariableChange={workspace.handleVariableChange}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TemplateWorkspaceMainPanel
          generation={workspace.gen}
          currentModel={workspace.currentModel}
          generating={workspace.generating}
          conversationId={conversationId}
          chatEndRef={workspace.chatEndRef}
          onGenerate={workspace.handleGenerate}
          onSendToConversation={workspace.handleSendToConversation}
        />

        {workspace.gen.generatedImages.length > 0 && (
          <TemplateWorkspaceRefineBar
            attachedImage={workspace.attachedImage}
            chatInput={workspace.chatInput}
            generating={workspace.generating}
            onAttachedImageChange={workspace.setAttachedImage}
            onChatInputChange={workspace.setChatInput}
            onSendRefine={workspace.handleSendRefine}
          />
        )}
      </div>
    </div>
  );
}
