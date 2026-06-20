'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Send } from 'lucide-react';
import { Button } from '../ui';
import { ImageUploader } from './ImageUploader';

interface TemplateWorkspaceRefineBarProps {
  attachedImage?: string;
  chatInput: string;
  generating: boolean;
  onAttachedImageChange: Dispatch<SetStateAction<string | undefined>>;
  onChatInputChange: Dispatch<SetStateAction<string>>;
  onSendRefine: () => void | Promise<void>;
}

export function TemplateWorkspaceRefineBar({
  attachedImage,
  chatInput,
  generating,
  onAttachedImageChange,
  onChatInputChange,
  onSendRefine,
}: TemplateWorkspaceRefineBarProps) {
  const tWs = useTranslations('templateWorkspace');

  return (
    <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid var(--border)' }}>
      {attachedImage && (
        <div className="mb-2">
          <ImageUploader value={attachedImage} onChange={onAttachedImageChange} folder="references" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-md cursor-pointer"
          style={{ color: 'var(--muted)' }}
          onClick={() => onAttachedImageChange(attachedImage ? undefined : '')}
        >
          <ImagePlus className="w-5 h-5" />
        </button>
        <input
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && onSendRefine()}
          placeholder={tWs('refinePlaceholder')}
          className="flex-1 h-10 px-3 text-sm rounded-lg outline-none"
          style={{
            border: '1px solid var(--input-border)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--foreground)',
          }}
          disabled={generating}
        />
        <Button
          className="cursor-pointer"
          disabled={generating || !chatInput.trim()}
          onClick={onSendRefine}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
