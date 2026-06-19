'use client';

import { Heart, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PromptTemplate } from '@autix/shared-lib';
import { FallbackImage } from './FallbackImage';
import { getTemplateCategoryI18nKey } from './category-utils';

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
      className="group cursor-pointer rounded-lg overflow-hidden transition-all bg-card border border-border hover:ring-2 hover:ring-primary"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <FallbackImage
          src={template.coverImage}
          alt={template.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          fallbackText={t('noCover')}
        />
      </div>

      <div className="p-3 space-y-2">
        <p className="text-sm font-medium truncate text-foreground">
          {template.title}
        </p>

        <div className="flex items-center gap-3">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {tCat(getTemplateCategoryI18nKey(template.category))}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="w-3 h-3" /> {template.useCount}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Heart className="w-3 h-3" /> {template.likeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
