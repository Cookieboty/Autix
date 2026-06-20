'use client';

import type { AgentKind, ModelConfigItem } from '@autix/shared-store';
import { ChatPromptInput } from './ChatPromptInput';
import { ChatToolbar } from './ChatToolbar';
import { InputModeSwitch, type InputMode } from './InputModeSwitch';
import type { LocalChatAttachment } from './chat-attachments';
import { VideoInputArea } from '../video/VideoInputArea';
import { VideoToolbar } from '../video/VideoToolbar';
import type { useVideoInputController } from '../video/useVideoInputController';

type VideoInputController = ReturnType<typeof useVideoInputController>;

export function ChatComposerSection({
  templateSheetOpen,
  visibleInputMode,
  onInputModeChange,
  inputModeDisabled,
  onSend,
  isStreaming,
  inputKind,
  resetToken,
  modelSupportsVision,
  videoInput,
  activeKind,
  inputEstimate,
  inputEstimateLoading,
  selectedSourceImages,
  onGenerateImage,
  onRemoveSourceImage,
  onClearSourceImages,
  activeTemplate,
  onOpenTemplateEditor,
  onReuseTemplate,
  onRemoveTemplate,
  injectValue,
  videoModels,
  videoModelsLoading,
  activeVideoTemplateName,
  onVideoModelChange,
  onOpenTemplateDrawer,
  activeImageTemplateName,
  imageSize,
  imageQuality,
  imageCount,
  onImageSizeChange,
  onImageQualityChange,
  onImageCountChange,
  onToolbarModelChange,
  chatToolbarLabels,
}: {
  templateSheetOpen: boolean;
  visibleInputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  inputModeDisabled: boolean;
  onSend: (content: string, attachments?: LocalChatAttachment[]) => void;
  isStreaming: boolean;
  inputKind: AgentKind;
  resetToken: number;
  modelSupportsVision: boolean;
  videoInput: VideoInputController;
  activeKind: AgentKind;
  inputEstimate?: { estimatedCost?: number | null } | null;
  inputEstimateLoading: boolean;
  selectedSourceImages: Array<{ url: string; prompt?: string }>;
  onGenerateImage: (instruction?: string, attachments?: LocalChatAttachment[]) => void;
  onRemoveSourceImage: (index: number) => void;
  onClearSourceImages: () => void;
  activeTemplate?: {
    id: string;
    title: string;
    coverImage?: string;
    variableCount: number;
  };
  onOpenTemplateEditor?: () => void;
  onReuseTemplate?: () => void;
  onRemoveTemplate?: () => void;
  injectValue?: { content: string; images?: string[]; token: number } | null;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  activeVideoTemplateName?: string;
  onVideoModelChange: (id: string) => void;
  onOpenTemplateDrawer: () => void;
  activeImageTemplateName?: string;
  imageSize: string;
  imageQuality: string;
  imageCount: number;
  onImageSizeChange: (value: string) => void;
  onImageQualityChange: (value: string) => void;
  onImageCountChange: (value: number) => void;
  onToolbarModelChange: () => void;
  chatToolbarLabels: {
    selectModel: string;
    selectTemplate: string;
    chatModelTooltip: string;
    noModelsGoConfig: string;
    modelPicker: {
      searchPlaceholder: string;
      empty: string;
    };
  };
}) {
  return (
    <div className="pointer-events-none relative z-30 w-full min-w-0 flex-shrink-0 px-6 pb-6 pt-2">
      <div
        className={`pointer-events-auto mx-auto w-full min-w-0 max-w-3xl rounded-2xl${templateSheetOpen ? ' border border-white/14 px-3 pb-2 pt-1 shadow-[0_24px_90px_rgba(0,0,0,0.35)]' : ''}`}
        style={templateSheetOpen ? {
          background:
            'linear-gradient(180deg, rgba(20,20,20,0.82), rgba(8,8,8,0.72))',
          backdropFilter: 'blur(34px) saturate(180%)',
          WebkitBackdropFilter: 'blur(34px) saturate(180%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.10), 0 24px 90px rgba(0,0,0,0.34)',
        } : undefined}
      >
        <div className="mb-2 flex justify-start">
          <InputModeSwitch
            value={visibleInputMode}
            onChange={onInputModeChange}
            disabled={inputModeDisabled}
          />
        </div>
        <ChatPromptInput
          onSend={onSend}
          isStreaming={isStreaming}
          inputKind={inputKind}
          resetToken={resetToken}
          enableImages={inputKind !== 'video' && (modelSupportsVision || inputKind === 'image')}
          enableVideo={inputKind === 'video'}
          imageWorkflowActive={inputKind === 'image'}
          headerSlot={inputKind === 'video' && !templateSheetOpen ? (
            <VideoInputArea
              mode={videoInput.mode}
              materials={videoInput.materials}
              frames={videoInput.frames}
              onAddMaterial={videoInput.addMaterials}
              onRemoveMaterial={videoInput.removeMaterial}
              onAddFrame={videoInput.addFrame}
              onRemoveFrame={videoInput.removeFrame}
              onSwapFirstLastFrames={videoInput.swapFirstLastFrames}
              onFrameFileUpload={videoInput.setFrameFile}
              onClearAll={videoInput.clearFrames}
            />
          ) : undefined}
          onPasteFiles={activeKind === 'video' ? videoInput.pasteFiles : undefined}
          estimatedCost={inputEstimate?.estimatedCost ?? null}
          estimatingCost={inputEstimateLoading}
          selectedSourceImages={inputKind === 'image' ? selectedSourceImages : []}
          onGenerateImage={onGenerateImage}
          onRemoveSourceImage={onRemoveSourceImage}
          onClearSourceImages={onClearSourceImages}
          activeTemplate={activeTemplate}
          onOpenTemplateEditor={onOpenTemplateEditor}
          onReuseTemplate={onReuseTemplate}
          injectValue={injectValue ?? undefined}
          glassEffect={templateSheetOpen}
          onRemoveTemplate={onRemoveTemplate}
        />
        {activeKind === 'video' ? (
          <VideoToolbar
            model={videoInput.model}
            onModelChange={onVideoModelChange}
            mode={videoInput.mode}
            onModeChange={videoInput.setMode}
            ratio={videoInput.ratio}
            onRatioChange={videoInput.setRatio}
            duration={videoInput.duration}
            onDurationChange={videoInput.setDuration}
            models={videoModels}
            modelsLoading={videoModelsLoading}
            activeTemplateName={activeVideoTemplateName}
            onOpenTemplateDrawer={onOpenTemplateDrawer}
          />
        ) : (
          <ChatToolbar
            kind={inputKind}
            activeTemplateName={activeImageTemplateName}
            imageSize={imageSize}
            imageQuality={imageQuality}
            imageCount={imageCount}
            onImageSizeChange={onImageSizeChange}
            onImageQualityChange={onImageQualityChange}
            onImageCountChange={onImageCountChange}
            onModelChange={onToolbarModelChange}
            onOpenTemplateDrawer={onOpenTemplateDrawer}
            labels={chatToolbarLabels}
          />
        )}
      </div>
    </div>
  );
}
