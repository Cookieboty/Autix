'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatPromptInput } from '../chat/ChatPromptInput';
import { ChatToolbar } from '../chat/ChatToolbar';
import { MessageBubble } from '../chat/MessageBubble';
import { TemplatePromptDialog } from '../chat/TemplatePromptDialog';
import { VideoInputArea } from '../video/VideoInputArea';
import { VideoToolbar } from '../video/VideoToolbar';
import type { MarketplaceChatDockController } from './marketplace-chat-dock-types';

export function MarketplaceChatDockView({
  template,
  tpl,
  onClose,
  messages,
  messagesEndRef,
  isStreaming,
  error,
  sessionId,
  promptDialogOpen,
  setPromptDialogOpen,
  varValues,
  selectedRefs,
  selectedSourceImages,
  injectValue,
  imageSize,
  setImageSize,
  imageQuality,
  setImageQuality,
  variables,
  referenceImages,
  hasTemplateEditor,
  isImageTemplate,
  isVideoTemplate,
  videoInput,
  handleSend,
  handleGenerateImage,
  handleGenerateImageFromInput,
  toggleSourceImage,
  removeSourceImage,
  clearSourceImages,
  reapplyTemplate,
  handleTemplateApply,
}: MarketplaceChatDockController) {
  const t = useTranslations('marketplace.chatDock');

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[82vh] w-full max-w-3xl flex-col px-4 pb-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/14 bg-black/82 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        {(sessionId || messages.length > 0) && (
          <div className="flex items-center justify-end gap-2 border-b border-white/10 px-3 py-2">
            {sessionId && (
              <a
                href={`/c/${sessionId}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/52 transition-colors hover:bg-white/8 hover:text-white"
              >
                <ExternalLink className="size-3" />
                {t('fullConversation')}
              </a>
            )}
          </div>
        )}

        {messages.length > 0 && (
          <div className="max-h-[42vh] overflow-y-auto px-4 py-3">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                images={msg.metadata?.images}
                attachments={msg.metadata?.attachments}
                messageType={msg.messageType}
                payload={msg.payload}
                isStreaming={msg.isStreaming}
                timestamp={msg.timestamp}
                onGenerateImage={handleGenerateImage}
                onSelectSourceImage={toggleSourceImage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div className="px-4 py-2 text-xs text-destructive">{error}</div>
        )}

        <div className="p-3">
          <ChatPromptInput
            onSend={handleSend}
            isStreaming={isStreaming}
            inputKind={isVideoTemplate ? 'video' : isImageTemplate ? 'image' : 'chat'}
            enableImages={isImageTemplate}
            enableVideo={isVideoTemplate}
            imageWorkflowActive={isImageTemplate}
            selectedSourceImages={isImageTemplate ? selectedSourceImages : []}
            onGenerateImage={handleGenerateImageFromInput}
            onRemoveSourceImage={removeSourceImage}
            onClearSourceImages={clearSourceImages}
            headerSlot={isVideoTemplate ? (
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
            activeTemplate={{
              id: template.id,
              title: template.title,
              coverImage: isImageTemplate ? tpl?.coverImage : undefined,
              variableCount: variables.length,
              editable: hasTemplateEditor,
            }}
            onOpenTemplateEditor={hasTemplateEditor ? () => setPromptDialogOpen(true) : undefined}
            onReuseTemplate={reapplyTemplate}
            onRemoveTemplate={onClose}
            injectValue={injectValue}
            glassEffect
            onPasteFiles={videoInput.pasteFiles}
          />
          <div className="mt-2">
            {isVideoTemplate ? (
              <VideoToolbar
                mode={videoInput.mode}
                model={videoInput.model}
                onModelChange={videoInput.setModel}
                onModeChange={videoInput.setMode}
                ratio={videoInput.ratio}
                onRatioChange={videoInput.setRatio}
                duration={videoInput.duration}
                onDurationChange={videoInput.setDuration}
              />
            ) : (
              <ChatToolbar
                kind={isImageTemplate ? 'image' : 'chat'}
                conversationId={sessionId ?? undefined}
                imageSize={imageSize}
                imageQuality={imageQuality}
                onImageSizeChange={setImageSize}
                onImageQualityChange={setImageQuality}
              />
            )}
          </div>
        </div>
      </div>
      <TemplatePromptDialog
        open={promptDialogOpen}
        onOpenChange={setPromptDialogOpen}
        templateName={template.title}
        templatePrompt={tpl?.prompt ?? ''}
        variables={variables}
        referenceImages={referenceImages}
        initialValues={varValues}
        initialSelectedRefs={selectedRefs}
        onApply={handleTemplateApply}
      />
    </div>
  );
}
