'use client';

import { useMemo, useState } from 'react';
import type { ImageTemplate } from '@autix/shared-store';

export function useImageTemplateFilters(imageTemplates: ImageTemplate[]) {
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [templateSort, setTemplateSort] = useState('popular');

  const templateCategories = useMemo(
    () => Array.from(new Set(imageTemplates.map((template) => template.category).filter(Boolean))).sort(),
    [imageTemplates],
  );

  const filteredTemplates = useMemo(
    () =>
      imageTemplates
        .filter((template) => {
          const q = templateSearch.trim().toLowerCase();
          const matchSearch =
            !q ||
            template.title.toLowerCase().includes(q) ||
            template.description?.toLowerCase().includes(q) ||
            template.tags?.some((tag) => tag.toLowerCase().includes(q));
          const matchCategory = templateCategory === 'all' || template.category === templateCategory;
          return matchSearch && matchCategory;
        })
        .sort((a, b) => {
          if (templateSort === 'newest') {
            return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime();
          }
          if (templateSort === 'likes') return (b.likeCount ?? 0) - (a.likeCount ?? 0);
          return (b.useCount ?? 0) - (a.useCount ?? 0);
        }),
    [imageTemplates, templateCategory, templateSearch, templateSort],
  );

  return {
    templateSearch,
    setTemplateSearch,
    templateCategory,
    setTemplateCategory,
    templateSort,
    setTemplateSort,
    templateCategories,
    filteredTemplates,
  };
}
