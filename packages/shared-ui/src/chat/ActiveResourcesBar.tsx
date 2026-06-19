'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, X, Sparkles } from 'lucide-react';
import {
  marketplaceActions,
  useResourcePanelStore,
  type ConversationResourceLink,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';

export function ActiveResourcesBar({ conversationId }: { conversationId?: string }) {
  const [items, setItems] = useState<ConversationResourceLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openPanel = useResourcePanelStore((s) => s.openPanel);
  const t = useTranslations('chat.activeResources');

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const items = await marketplaceActions.listConversationResources(conversationId);
      setItems(items);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => void refresh();
    window.addEventListener('conversation-resources:changed', handler);
    return () => window.removeEventListener('conversation-resources:changed', handler);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const detach = async (item: ConversationResourceLink) => {
    if (!conversationId) return;
    await marketplaceActions.detachConversationResource(
      conversationId,
      item.resourceType,
      item.resourceId,
    );
    setItems((cur) => cur.filter((it) => it.id !== item.id));
    window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
  };

  const skillItems = items.filter(
    (item) => item.resourceType === 'SKILL' || item.resourceType === 'MCP',
  );

  if (!conversationId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground border border-border transition-colors ${open ? 'bg-card' : 'bg-transparent'}`}
        title={t('title')}
      >
        <Sparkles className="h-4 w-4" />
        <span>{skillItems.length > 0 ? `Skills ${skillItems.length}` : 'Skills'}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[320px] overflow-hidden rounded-xl shadow-xl bg-card border border-border">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Skills / MCP
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs bg-secondary text-foreground"
              onClick={() => {
                openPanel({ conversationId, source: 'chat' });
                setOpen(false);
              }}
            >
              <Plus className="h-3 w-3" />
              {t('add')}
            </button>
          </div>

          <div className="max-h-[280px] overflow-y-auto p-2">
            {skillItems.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {loading ? t('loading') : t('empty')}
              </div>
            ) : (
              <div className="space-y-1">
                {skillItems.map((item) => {
                  const resource = item.resource as { title?: string; category?: string } | undefined;
                  return (
                    <div
                      key={item.id}
                      className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 bg-secondary"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          {resource?.title ?? item.resourceType}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {resource?.category ?? item.resourceType}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-1 hover:bg-foreground/10"
                        onClick={() => void detach(item)}
                        aria-label={t('remove')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
