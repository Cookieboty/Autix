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
  const tc = useTranslations('common');
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
          style={{
            background:
              'radial-gradient(circle at 16% 0%, rgba(255,255,255,0.10), transparent 32%), radial-gradient(circle at 86% 10%, rgba(255,255,255,0.06), transparent 30%), linear-gradient(180deg, rgba(14,14,14,0.88), rgba(6,6,6,0.76))',
            WebkitBackdropFilter: 'blur(42px) saturate(1.7)',
            backdropFilter: 'blur(42px) saturate(1.7)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
          className="absolute inset-x-0 bottom-0 top-12 z-20 flex flex-col overflow-hidden border-t border-white/10 text-white"
          tabIndex={-1}
          ref={(el) => {
            if (el) el.focus();
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/10 px-5 py-3">
            <h2 className="text-base font-semibold text-white">
              {kind === 'video' ? t('template.drawerTitleVideo') : t('template.drawerTitle')}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex size-7 items-center justify-center rounded-md text-white/58 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={tc('close')}
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Filter bar */}
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 bg-black/15 px-5 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('template.searchPlaceholder')}
              className="h-8 w-48 shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-3 text-xs text-white outline-none transition-colors placeholder:text-white/42 focus:border-white/55 focus:bg-white/[0.08]"
            />
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${activeCategory === null
                ? 'border-white/80 bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.12)]'
                : 'border-white/10 bg-white/[0.07] text-white/68 hover:bg-white/[0.12] hover:text-white'
                }`}
            >
              {tc('all')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${activeCategory === cat
                  ? 'border-white/80 bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.12)]'
                  : 'border-white/10 bg-white/[0.07] text-white/68 hover:bg-white/[0.12] hover:text-white'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div
            className="flex-1 overflow-y-auto p-5"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 40%)',
            }}
          >
            {loading ? (
              <div className="py-12 text-center text-sm text-white/58">{tc('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/58">
                {t('template.empty')}
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
                      className={`group overflow-hidden rounded-xl border text-left shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${isActive
                        ? 'border-white/80 bg-white/[0.07] ring-2 ring-white/70 shadow-white/10'
                        : 'border-white/12 bg-white/[0.055] hover:-translate-y-0.5 hover:border-white/55 hover:bg-white/[0.09] hover:shadow-white/10'
                        }`}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white/[0.06]">
                        <FallbackImage
                          src={tpl.coverImage ?? undefined}
                          alt={tpl.title ?? t('template.templateAlt')}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          fallbackText={t('template.noCover')}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/58 via-black/8 to-black/34" />
                        <div className="absolute inset-x-0 top-0 px-2.5 pb-4 pt-2">
                          <div className="truncate text-sm font-medium text-white drop-shadow-sm">
                            {tpl.title ?? t('template.untitled')}
                          </div>
                        </div>
                        {isActive && (
                          <span className="absolute right-2 top-8 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-black shadow-[0_8px_20px_rgba(255,255,255,0.16)]">
                            {t('template.current')}
                          </span>
                        )}
                        {!isActive && (
                          <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center bg-white/90 py-1.5 text-[11px] font-medium text-black backdrop-blur-sm transition-transform group-hover:translate-y-0">
                            {t('template.useThisTemplate')}
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
