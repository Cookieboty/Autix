'use client';

import { Heart, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PromptTemplate } from '@/lib/api';
import { FallbackImage } from './FallbackImage';

const CATEGORY_I18N_KEY: Record<string, string> = {
  '人像': 'portrait', '风景': 'landscape', '产品': 'product',
  '插画': 'illustration', '建筑': 'architecture', '科幻': 'scifi', '场景': 'scene',
};

export function TemplateCard({
  template,
  onClick,
}: {
  template: PromptTemplate;
  onClick?: () => void;
}) {
  const t = useTranslations('template');
  const tCat = useTranslations('categoryOptions');
  return (
    <div
      className="group cursor-pointer rounded-lg overflow-hidden transition-all hover:ring-2 hover:ring-[var(--accent)]"
      style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--panel-muted)' }}>
        <FallbackImage
          src={template.coverImage}
          alt={template.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          fallbackText={t('noCover')}
        />
      </div>

      <div className="p-3 space-y-2">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
          {template.title}
        </p>

        <div className="flex items-center gap-3">
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--muted)' }}
          >
            {tCat(CATEGORY_I18N_KEY[template.category] ?? 'portrait')}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            <Eye className="w-3 h-3" /> {template.useCount}
          </span>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            <Heart className="w-3 h-3" /> {template.likeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
