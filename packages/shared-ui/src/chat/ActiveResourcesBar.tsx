'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, X, Sparkles } from 'lucide-react';
import {
  conversationResourcesApi,
  type ConversationResourceLink,
} from '@autix/shared-lib';
import { useResourcePanelStore } from '@autix/shared-store';

export function ActiveResourcesBar({ conversationId }: { conversationId?: string }) {
  const [items, setItems] = useState<ConversationResourceLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openPanel = useResourcePanelStore((s) => s.openPanel);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await conversationResourcesApi.list(conversationId);
      setItems(res.data ?? []);
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
    await conversationResourcesApi.detach(
      conversationId,
      item.resourceType,
      item.resourceId,
    );
    setItems((cur) => cur.filter((it) => it.id !== item.id));
    window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
  };

  if (!conversationId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        style={{
          backgroundColor: open ? 'var(--surface)' : 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
        title="本会话激活资源"
      >
        <Sparkles className="h-4 w-4" />
        <span>{items.length > 0 ? `资源 ${items.length}` : '添加资源'}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[320px] overflow-hidden rounded-xl shadow-xl"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Active Resources
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
              style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)' }}
              onClick={() => {
                openPanel({ conversationId, source: 'chat' });
                setOpen(false);
              }}
            >
              <Plus className="h-3 w-3" />
              添加
            </button>
          </div>

          <div className="max-h-[280px] overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                {loading ? '加载中...' : '当前会话未激活资源'}
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => {
                  const resource = item.resource as { title?: string; category?: string } | undefined;
                  return (
                    <div
                      key={item.id}
                      className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2"
                      style={{ backgroundColor: 'var(--panel-muted)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm" style={{ color: 'var(--foreground)' }}>
                          {resource?.title ?? item.resourceType}
                        </div>
                        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                          {resource?.category ?? item.resourceType}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-1 hover:bg-black/10"
                        onClick={() => void detach(item)}
                        aria-label="移除资源"
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
