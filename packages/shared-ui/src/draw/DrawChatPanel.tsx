'use client';

import type {
  ClipboardEvent as ReactClipboardEvent,
  RefObject,
} from 'react';
import {
  Film,
  LayoutGrid,
  Loader2,
  Plus,
  Send,
  Share2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { Conversation, ModelConfigItem } from '@autix/shared-store';
import {
  ConversationMenu,
  DrawModelPicker,
  IconBtn,
  MessageBubble,
  ReferenceStrip,
} from './DrawWorkspaceParts';
import { firstUserPrompt } from './draw-message-helpers';
import type {
  CanvasImageRef,
  ChatMessage,
  ComposerImage,
  GenerationMode,
  Tr,
  UploadTarget,
} from './draw-types';

export function DrawChatPanel(props: {
  t: Tr;
  mode: GenerationMode;
  activeTitle: string;
  messages: ChatMessage[];
  conversationId: string;
  conversationMenuOpen: boolean;
  conversations: Conversation[];
  conversationSearch: string;
  creatingConversation: boolean;
  pickerModels: ModelConfigItem[];
  pickerSelectedModel: ModelConfigItem | null;
  pickerSelectedModelId: string | null;
  modelsLoading: boolean;
  canGenerate: boolean;
  showUpsell: boolean;
  entitlementReason: string | null;
  selectedImages: CanvasImageRef[];
  composerImages: ComposerImage[];
  composerRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  generating: boolean;
  canSend: boolean;
  onSearchConversations: (value: string) => void;
  onToggleConversationMenu: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onShare: () => void;
  onModelChange: (id: string | null) => void;
  onTileHistoryToCanvas: () => void;
  onLocateOrPlace: (url: string, label: string) => void;
  onDismissUpsell: () => void;
  onRemoveComposerImage: (id: string) => void;
  onInputChange: (value: string) => void;
  onComposerPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onOpenUpload: (target: UploadTarget) => void;
  onSubmit: () => void;
}) {
  const { t } = props;

  return (
    <aside className="flex max-h-[45svh] w-full shrink-0 flex-col border-t border-white/10 bg-black text-white xl:h-full xl:max-h-none xl:w-[420px] xl:border-l xl:border-t-0">
      <div className="relative z-30 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{firstUserPrompt(props.messages) ?? props.activeTitle}</h1>
          <ConversationMenu
            t={t}
            open={props.conversationMenuOpen}
            activeConversationId={props.conversationId}
            conversations={props.conversations}
            search={props.conversationSearch}
            loading={props.creatingConversation}
            onSearch={props.onSearchConversations}
            onToggle={props.onToggleConversationMenu}
            onCreate={props.onCreateConversation}
            onSelect={props.onSelectConversation}
          />
          <IconBtn title={t('chat.share')} onClick={props.onShare}><Share2 className="size-4" /></IconBtn>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <DrawModelPicker
            t={t}
            models={props.pickerModels}
            selectedModel={props.pickerSelectedModel}
            selectedModelId={props.pickerSelectedModelId}
            loading={props.modelsLoading}
            onChange={props.onModelChange}
          />
          <IconBtn title={t('chat.tileAll')} onClick={props.onTileHistoryToCanvas}><LayoutGrid className="size-4" /></IconBtn>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-black px-5 py-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-white/45">
          {props.mode === 'video' ? <Film className="size-3.5" /> : <Sparkles className="size-3.5" />}
          {props.mode === 'video' ? t('mode.videoHint') : t('mode.imageHint')}
        </div>
        {props.messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-white/45">{t('chat.empty')}</p>
        ) : (
          props.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} t={t} onImageClick={(url) => props.onLocateOrPlace(url, msg.text)} />
          ))
        )}
      </div>

      {!props.canGenerate && props.mode === 'image' && props.showUpsell && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
          <Sparkles className="size-4 shrink-0" />
          <span className="flex-1">{props.entitlementReason ?? t('actions.generateComingSoon')}</span>
          <button type="button" onClick={props.onDismissUpsell} className="text-amber-500"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="border-t border-white/10 bg-black p-4">
        {(props.selectedImages.length > 0 || props.composerImages.length > 0) && (
          <ReferenceStrip
            t={t}
            selectedImages={props.selectedImages}
            composerImages={props.composerImages}
            onRemoveComposer={props.onRemoveComposerImage}
          />
        )}
        <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-white/24 focus-within:ring-[3px] focus-within:ring-white/[0.08]">
          <textarea
            ref={props.composerRef}
            value={props.input}
            onChange={(event) => props.onInputChange(event.target.value)}
            onPaste={props.onComposerPaste}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                props.onSubmit();
              }
            }}
            placeholder={props.mode === 'video' ? t('prompt.videoPlaceholder') : t('prompt.placeholder')}
            rows={1}
            className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/35"
          />
          <div className="flex items-center gap-1 px-1">
            <IconBtn title={t('chat.attach')} onClick={() => props.onOpenUpload('composer')}><Plus className="size-4" /></IconBtn>
            <IconBtn title={t('chat.attachToCanvas')} onClick={() => props.onOpenUpload('canvas')}><Upload className="size-4" /></IconBtn>
            <button
              type="button"
              disabled={!props.canSend}
              onClick={props.onSubmit}
              className="ml-auto inline-flex size-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              {props.generating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
