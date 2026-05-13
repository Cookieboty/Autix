// packages/shared-ui/src/chat/TemplatePickerDrawer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  conversationResourcesApi,
  imageTemplateApi,
  videoTemplateApi,
  type AgentKind,
} from '@autix/shared-lib';
import { useTranslations } from 'next-intl';
import { FallbackImage } from '../template/FallbackImage';

const KIND_TO_RESOURCE_TYPE: Partial<Record<AgentKind, string>> = {
  image: 'IMAGE_TEMPLATE',
  video: 'VIDEO_TEMPLATE',
};

const KIND_TO_API: Partial<
  Record<AgentKind, typeof imageTemplateApi | typeof videoTemplateApi>
> = {
  image: imageTemplateApi,
  video: videoTemplateApi,
};

interface TemplatePickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AgentKind;
  conversationId: string;
  currentTemplateId?: string;
  onSelected: () => void;
}

interface TemplateItem {
  id: string;
  title?: string;
  coverImage?: string | null;
  category?: string;
}

export function TemplatePickerDrawer({
  open,
  onOpenChange,
  kind,
  conversationId,
  currentTemplateId,
  onSelected,
}: TemplatePickerDrawerProps) {
  const t = useTranslations('chat');
  const resourceType = KIND_TO_RESOURCE_TYPE[kind];
  const api = KIND_TO_API[kind];

  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !api) return;
    let cancelled = false;
    setLoading(true);
    api
      .list({ pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as any;
        setItems(data?.items ?? (Array.isArray(data) ? data : []));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, api]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of items) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => (t.title ?? '').toLowerCase().includes(q));
    }
    if (activeCategory) {
      result = result.filter((t) => t.category === activeCategory);
    }
    return result;
  }, [items, search, activeCategory]);

  const handleSelect = async (templateId: string) => {
    if (!resourceType) return;
    setAttaching(templateId);
    try {
      if (currentTemplateId) {
        await conversationResourcesApi.detach(
          conversationId,
          resourceType as any,
          currentTemplateId,
        );
      }
      await conversationResourcesApi.attach(
        conversationId,
        resourceType as any,
        templateId,
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      }
      onSelected();
    } catch (err: any) {
      console.error('Template attach failed:', err);
    } finally {
      setAttaching(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onOpenChange(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ backgroundColor: 'color-mix(in srgb, var(--background) 72%, transparent)', WebkitBackdropFilter: 'blur(40px) saturate(1.8)', backdropFilter: 'blur(40px) saturate(1.8)' }}
          className="absolute inset-x-0 top-12 bottom-0 z-20 flex flex-col overflow-hidden"
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-base font-semibold text-foreground">
              {t('template.drawerTitle')}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Filter bar */}
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-5 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('template.searchPlaceholder')}
              className="h-8 w-48 shrink-0 rounded-md border border-input bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无可用模板
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filtered.map((tpl) => {
                  const isActive = tpl.id === currentTemplateId;
                  const isAttaching = attaching === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isAttaching}
                      onClick={() => handleSelect(tpl.id)}
                      className={`group overflow-hidden rounded-xl text-left transition-all ${
                        isActive
                          ? 'ring-2 ring-primary'
                          : 'ring-1 ring-transparent hover:ring-2 hover:ring-primary/50'
                      }`}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                        <FallbackImage
                          src={tpl.coverImage ?? undefined}
                          alt={tpl.title ?? '模板'}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          fallbackText="暂无封面"
                        />
                        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-2.5 pb-4 pt-2">
                          <div className="truncate text-sm font-medium text-white drop-shadow-sm">
                            {tpl.title ?? '未命名模板'}
                          </div>
                        </div>
                        {isActive && (
                          <span className="absolute right-2 top-8 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            {t('template.current')}
                          </span>
                        )}
                        {!isActive && (
                          <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center bg-primary/90 py-1.5 text-[11px] font-medium text-primary-foreground backdrop-blur-sm transition-transform group-hover:translate-y-0">
                            使用此模板
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
