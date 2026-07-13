'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialAssetType, MaterialLibrarySource } from '@autix/shared-store';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

export type FilterType = MaterialAssetType | 'all';
/** 素材库来源筛选——"全部/上传/收藏/历史"，非 Tab（不切换页面结构，只过滤数据源）。 */
export type LibrarySourceFilter = 'ALL' | MaterialLibrarySource;

const TYPE_OPTIONS: FilterType[] = ['all', 'image', 'video', 'audio', 'file'];
const LIBRARY_SOURCE_OPTIONS: LibrarySourceFilter[] = ['ALL', 'UPLOAD', 'FAVORITE', 'HISTORY'];

/** Plan C Task 12：类型筛选 + librarySource 筛选 + 搜索框，从 MaterialLibraryView 拆出的筛选栏。 */
export function MaterialFilterBar({
  filterType,
  onFilterTypeChange,
  librarySource,
  onLibrarySourceChange,
  search,
  onSearchChange,
}: {
  filterType: FilterType;
  onFilterTypeChange: (value: FilterType) => void;
  librarySource: LibrarySourceFilter;
  onLibrarySourceChange: (value: LibrarySourceFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const t = useTranslations('materials');

  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onFilterTypeChange(option)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              filterType === option
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`type.${option}`)}
          </button>
        ))}
        <span className="mx-1 hidden self-center text-border sm:inline">|</span>
        {LIBRARY_SOURCE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onLibrarySourceChange(option)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              librarySource === option
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`librarySource.${option}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-1 items-center gap-2 lg:max-w-md">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </label>
      </div>
    </div>
  );
}
