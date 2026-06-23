'use client';

import type { ComponentProps } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import type { AgentKind, ModelConfigItem } from '@autix/shared-store';
import { Conversation, ConversationContent, ConversationScrollButton } from '../ai-elements/conversation';
import { ArtifactPanel } from '../artifact/ArtifactPanel';
import { ChatComposerSection } from './ChatComposerSection';
import { ChatErrorAlert } from './ChatErrorAlert';
import { ChatMessageList } from './ChatMessageList';
import { ChatSidePanels } from './ChatSidePanels';
import { ChatTemplatePromptHost } from './ChatTemplatePromptHost';
import { ChatViewHeader } from './ChatViewHeader';
import type { InputMode } from './InputModeSwitch';
import type { LocalChatAttachment } from './chat-attachments';
import type { SourceImageRef } from './chat-source-images';
import type { ChatViewMessage } from './view/chat-view-types';
import type { useVideoInputController } from '../video/useVideoInputController';

type VideoInputController = ReturnType<typeof useVideoInputController>;

type ActiveTemplateSummary = {
  id: string;
  title: string;
  coverImage?: string;
  variableCount: number;
};

type PromptInject = {
  content: string;
  images?: string[];
  token: number;
} | null;

type ChatToolbarLabels = {
  selectModel: string;
  selectTemplate: string;
  chatModelTooltip: string;
  noModelsGoConfig: string;
  modelPicker: {
    searchPlaceholder: string;
    empty: string;
  };
};

type TemplatePromptHostProps = ComponentProps<typeof ChatTemplatePromptHost>;

type ChatColumnProps = {
  activeSessionId?: string | null;
  activeKind: AgentKind;
  activeImageTemplateName?: string;
  activeTemplate?: ActiveTemplateSummary;
  availableModelCount: number;
  chatError: string | null;
  chatToolbarLabels: ChatToolbarLabels;
  conversationPanelMode: 'electron' | 'web';
  currentProgress: {
    stepKey: string;
    displayName: string;
    index: number;
    total: number;
  } | null;
  currentTemplateId?: string;
  generatedImagesCount: number;
  hasActiveModeTemplate: boolean;
  imageQuality: string;
  imageSize: string;
  inputEstimate?: { estimatedCost?: number | null } | null;
  inputEstimateLoading: boolean;
  inputKind: AgentKind;
  inputModeDisabled: boolean;
  injectValue: PromptInject;
  isImageWorkflowRunning: boolean;
  isLocked: boolean;
  isStreaming: boolean;
  isWaitingForUser: boolean;
  messages: ChatViewMessage[];
  modelSupportsVision: boolean;
  resetToken: number;
  selectedSourceImages: SourceImageRef[];
  streamingMessage: ChatViewMessage | null;
  templatePromptHost: TemplatePromptHostProps;
  templateSheetOpen: boolean;
  videoInput: VideoInputController;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  activeVideoTemplateName?: string;
  visibleInputMode: InputMode;
  onChatErrorDismiss: () => void;
  onClearSourceImages: () => void;
  onGenerateImage: (payload?: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: SourceImageRef[];
    inputImages?: string[];
  }) => void;
  onGenerateImageFromInput: (instruction?: string, attachments?: LocalChatAttachment[]) => void;
  onImageQualityChange: (value: string) => void;
  onImageSizeChange: (value: string) => void;
  onInputModeChange: (mode: InputMode) => void;
  onOpenTemplateDrawer: () => void;
  onOpenTemplateEditor?: () => void;
  onRemoveSourceImage: (index: number) => void;
  onRemoveTemplate?: () => void;
  onReuseTemplate?: () => void;
  onSelectSourceImage: (image: SourceImageRef) => void;
  onSend: (content: string, attachments?: LocalChatAttachment[]) => void;
  onTemplateSelected: () => void;
  onTemplateSheetOpenChange: (open: boolean) => void;
  onToggleSidebar?: () => void;
  onToolbarModelChange: () => void;
  onUIAction: (componentId: string, action: string, data: Record<string, unknown>) => void;
  onVideoModelChange: (id: string) => void;
};

type ChatViewShellProps = ChatColumnProps & {
  hasActiveArtifact: boolean;
};

function ChatColumn({
  activeSessionId,
  activeKind,
  activeImageTemplateName,
  activeTemplate,
  availableModelCount,
  chatError,
  chatToolbarLabels,
  conversationPanelMode,
  currentProgress,
  currentTemplateId,
  generatedImagesCount,
  hasActiveModeTemplate,
  imageQuality,
  imageSize,
  inputEstimate,
  inputEstimateLoading,
  inputKind,
  inputModeDisabled,
  injectValue,
  isImageWorkflowRunning,
  isLocked,
  isStreaming,
  isWaitingForUser,
  messages,
  modelSupportsVision,
  resetToken,
  selectedSourceImages,
  streamingMessage,
  templatePromptHost,
  templateSheetOpen,
  videoInput,
  videoModels,
  videoModelsLoading,
  activeVideoTemplateName,
  visibleInputMode,
  onChatErrorDismiss,
  onClearSourceImages,
  onGenerateImage,
  onGenerateImageFromInput,
  onImageQualityChange,
  onImageSizeChange,
  onInputModeChange,
  onOpenTemplateDrawer,
  onOpenTemplateEditor,
  onRemoveSourceImage,
  onRemoveTemplate,
  onReuseTemplate,
  onSelectSourceImage,
  onSend,
  onTemplateSelected,
  onTemplateSheetOpenChange,
  onToggleSidebar,
  onToolbarModelChange,
  onUIAction,
  onVideoModelChange,
}: ChatColumnProps) {
  return (
    <div className="relative flex h-full min-w-0 overflow-hidden bg-transparent">
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <ChatViewHeader onToggleSidebar={onToggleSidebar} />

        <ChatErrorAlert error={chatError} onDismiss={onChatErrorDismiss} />

        <div className="relative min-h-0 flex-1 bg-transparent">
          <Conversation className="relative z-0 h-full flex-1 min-w-0 py-8">
            <ConversationContent className="mx-auto w-full min-w-0 max-w-3xl gap-6 px-6">
              <ChatMessageList
                messages={messages}
                streamingMessage={streamingMessage}
                isLocked={isLocked}
                activeSessionId={activeSessionId}
                templateSheetOpen={templateSheetOpen}
                hasActiveModeTemplate={hasActiveModeTemplate}
                availableModelCount={availableModelCount}
                isStreaming={isStreaming}
                isWaitingForUser={isWaitingForUser}
                isImageWorkflowRunning={isImageWorkflowRunning}
                currentProgress={currentProgress}
                onUIAction={onUIAction}
                onGenerateImage={onGenerateImage}
                onSelectSourceImage={onSelectSourceImage}
              />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        <ChatComposerSection
          templateSheetOpen={templateSheetOpen}
          visibleInputMode={visibleInputMode}
          onInputModeChange={onInputModeChange}
          inputModeDisabled={inputModeDisabled}
          onSend={onSend}
          isStreaming={isStreaming}
          inputKind={inputKind}
          resetToken={resetToken}
          modelSupportsVision={modelSupportsVision}
          videoInput={videoInput}
          activeKind={activeKind}
          inputEstimate={inputEstimate}
          inputEstimateLoading={inputEstimateLoading}
          selectedSourceImages={selectedSourceImages}
          onGenerateImage={onGenerateImageFromInput}
          onRemoveSourceImage={onRemoveSourceImage}
          onClearSourceImages={onClearSourceImages}
          activeTemplate={activeTemplate}
          onOpenTemplateEditor={onOpenTemplateEditor}
          onReuseTemplate={onReuseTemplate}
          injectValue={injectValue}
          onRemoveTemplate={onRemoveTemplate}
          videoModels={videoModels}
          videoModelsLoading={videoModelsLoading}
          activeVideoTemplateName={activeVideoTemplateName}
          onVideoModelChange={onVideoModelChange}
          onOpenTemplateDrawer={onOpenTemplateDrawer}
          activeImageTemplateName={activeImageTemplateName}
          imageSize={imageSize}
          imageQuality={imageQuality}
          onImageSizeChange={onImageSizeChange}
          onImageQualityChange={onImageQualityChange}
          onToolbarModelChange={onToolbarModelChange}
          chatToolbarLabels={chatToolbarLabels}
        />
      </div>

      <ChatSidePanels
        conversationId={activeSessionId ?? undefined}
        mode={conversationPanelMode}
        generatedImagesCount={generatedImagesCount}
        templateSheetOpen={templateSheetOpen}
        onTemplateSheetOpenChange={onTemplateSheetOpenChange}
        activeKind={activeKind}
        currentTemplateId={currentTemplateId}
        onTemplateSelected={onTemplateSelected}
      />

      <ChatTemplatePromptHost {...templatePromptHost} />
    </div>
  );
}

export function ChatViewShell({ hasActiveArtifact, ...chatColumnProps }: ChatViewShellProps) {
  const chatColumn = <ChatColumn {...chatColumnProps} />;

  if (!hasActiveArtifact) {
    return <div className="h-full">{chatColumn}</div>;
  }

  return (
    <Group orientation="horizontal" className="h-full w-full" id="main-chat-group">
      <Panel
        id="chat-panel"
        defaultSize="40%"
        minSize="20%"
        maxSize="80%"
        style={{ minWidth: 0, overflow: 'hidden' }}
      >
        {chatColumn}
      </Panel>
      <Separator
        id="main-separator"
        style={{
          flexBasis: '12px',
          width: '12px',
          cursor: 'col-resize',
          background: 'transparent',
          zIndex: 1,
          userSelect: 'none',
        }}
      />
      <Panel
        id="artifact-panel"
        defaultSize="60%"
        minSize="20%"
        maxSize="80%"
        style={{ minWidth: 0, overflow: 'hidden' }}
      >
        <ArtifactPanel />
      </Panel>
    </Group>
  );
}
