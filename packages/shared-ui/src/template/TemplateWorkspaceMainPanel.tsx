'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Send } from 'lucide-react';
import type { TemplateGeneration } from '@autix/shared-store';
import { Button } from '../ui';
import { FallbackImage } from './FallbackImage';

interface TemplateWorkspaceMainPanelProps {
  generation: TemplateGeneration;
  currentModel: string;
  generating: boolean;
  conversationId?: string | null;
  chatEndRef: RefObject<HTMLDivElement | null>;
  onGenerate: () => void | Promise<void>;
  onSendToConversation: () => void | Promise<void>;
}

export function TemplateWorkspaceMainPanel({
  generation,
  currentModel,
  generating,
  conversationId,
  chatEndRef,
  onGenerate,
  onSendToConversation,
}: TemplateWorkspaceMainPanelProps) {
  const tWs = useTranslations('templateWorkspace');
  const hasTurns = (generation.turns?.length ?? 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {generation.generatedImages.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {tWs('generateResults')}
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                {currentModel}
              </span>
            </h2>
            <div className="flex gap-2">
              {conversationId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={onSendToConversation}
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> {tWs('sendToCurrentConversation')}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onGenerate}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> {tWs('regenerate')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {generation.generatedImages.map((imgSrc, index) => (
              <FallbackImage
                key={index}
                src={imgSrc}
                alt={tWs('generatedNumber', { n: index + 1 })}
                className="w-full rounded-lg object-cover aspect-square"
                style={{ border: '1px solid var(--border)' }}
                fallbackText={tWs('imageNumber', { n: index + 1 })}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center h-64 rounded-lg gap-4"
          style={{ border: '2px dashed var(--border)', backgroundColor: 'var(--panel-muted)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {generating ? tWs('generating') : tWs('clickToGenerate')}
          </p>
          {!generating && (
            <Button className="cursor-pointer" onClick={onGenerate}>
              {tWs('generateNow')}
            </Button>
          )}
        </div>
      )}

      {hasTurns && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {tWs('multiTurnRefine')}
          </h2>
          {generation.turns!.map((turn) => (
            <div
              key={turn.id}
              className="p-3 rounded-lg space-y-2"
              style={{
                backgroundColor: turn.role === 'USER' ? 'transparent' : 'var(--panel-muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: turn.role === 'USER' ? 'var(--accent)' : 'var(--panel-muted)',
                    color: turn.role === 'USER' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {turn.role === 'USER' ? tWs('you') : tWs('ai')}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {new Date(turn.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                {turn.content}
              </p>
              {turn.images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {turn.images.map((imgSrc, index) => (
                    <FallbackImage
                      key={index}
                      src={imgSrc}
                      alt=""
                      className="w-full rounded object-cover aspect-square"
                      fallbackText=""
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  );
}
