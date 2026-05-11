'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  conversationResourcesApi,
  imageTemplateApi,
  videoTemplateApi,
  type AgentKind,
  type MarketplaceTypeSlug,
} from '@autix/shared-lib';
import { FallbackImage } from '../template/FallbackImage';

const KIND_TO_SLUG: Partial<Record<AgentKind, MarketplaceTypeSlug>> = {
  image: 'image-templates',
  video: 'video-templates',
};

const KIND_TO_RESOURCE_TYPE: Partial<Record<AgentKind, string>> = {
  image: 'IMAGE_TEMPLATE',
  video: 'VIDEO_TEMPLATE',
};

const KIND_TO_API: Partial<Record<AgentKind, typeof imageTemplateApi>> = {
  image: imageTemplateApi,
  video: videoTemplateApi,
};

interface TemplateGalleryDialogProps {
  open: boolean;
  onClose: () => void;
  kind: AgentKind;
  conversationId: string;
  currentTemplateId?: string;
  onSelected: () => void;
}

export function TemplateGalleryDialog({
  open,
  onClose,
  kind,
  conversationId,
  currentTemplateId,
  onSelected,
}: TemplateGalleryDialogProps) {
  const slug = KIND_TO_SLUG[kind];
  const resourceType = KIND_TO_RESOURCE_TYPE[kind];
  const api = KIND_TO_API[kind];
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

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
      onClose();
    } catch (err: any) {
      console.error('Template attach failed:', err);
    } finally {
      setAttaching(null);
    }
  };

  if (!open || !slug) return null;

  const typedItems = items as Array<{
    id: string;
    title?: string;
    coverImage?: string | null;
  }>;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh]" onClick={onClose}>
      <div
        className="relative w-[min(900px,calc(100vw-48px))] max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            选择{kind === 'image' ? '图片' : '视频'}模板
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 64px)' }}>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
          ) : typedItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无可用模板
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {typedItems.map((tpl) => {
                const isActive = tpl.id === currentTemplateId;
                const isAttaching = attaching === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={isAttaching}
                    onClick={() => handleSelect(tpl.id)}
                    className={`group overflow-hidden rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-primary ring-2 ring-primary'
                        : 'border-border hover:ring-2 hover:ring-primary'
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <FallbackImage
                        src={tpl.coverImage ?? undefined}
                        alt={tpl.title ?? '模板'}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        fallbackText="暂无封面"
                      />
                      {isActive && (
                        <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                          当前
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="truncate text-sm font-medium text-foreground">
                        {tpl.title ?? '未命名模板'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
