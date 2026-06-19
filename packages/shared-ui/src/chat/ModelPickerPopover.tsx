'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface ModelPickerPopoverProps {
  candidates: ModelConfigItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  trigger: React.ReactNode;
  labels?: {
    searchPlaceholder?: string;
    empty?: string;
  };
}

export function ModelPickerPopover({
  candidates,
  value,
  onChange,
  placeholder,
  trigger,
  labels,
}: ModelPickerPopoverProps) {
  const t = useTranslations('chat.modelPicker');
  const l = {
    searchPlaceholder: labels?.searchPlaceholder ?? t('searchPlaceholder'),
    empty: labels?.empty ?? t('empty'),
  };
  const resolvedPlaceholder = placeholder ?? t('placeholder');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(-1);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.trim().toLowerCase();
    return candidates.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, ModelConfigItem[]> = {};
    for (const m of filtered) {
      const key = m.provider || 'Other';
      (groups[key] ??= []).push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const flatItems = useMemo(() => {
    const items: ModelConfigItem[] = [];
    for (const [, models] of grouped) items.push(...models);
    return items;
  }, [grouped]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < flatItems.length) {
      e.preventDefault();
      handleSelect(flatItems[activeIndex].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (activeIndex >= 0) {
      const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const renderItem = (model: ModelConfigItem, index: number) => (
    <button
      key={`${model.id}-${index}`}
      type="button"
      data-index={index}
      onClick={() => handleSelect(model.id)}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${activeIndex === index ? 'bg-secondary' : 'hover:bg-secondary'
        } ${value === model.id ? 'text-primary' : 'text-foreground'}`}
      role="option"
      aria-selected={value === model.id}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium">{model.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {model.model} · {model.provider}
        </div>
      </div>
      {value === model.id && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  );

  const groupStartIndex = new Map<string, number>();
  {
    let cursor = 0;
    for (const [provider, models] of grouped) {
      groupStartIndex.set(provider, cursor);
      cursor += models.length;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-h-[70vh] overflow-hidden p-0"
        onKeyDown={handleKeyDown}
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1); }}
            placeholder={l.searchPlaceholder || resolvedPlaceholder}
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[calc(70vh-48px)] overflow-y-auto" role="listbox">
          {/* Grouped by provider */}
          {grouped.map(([provider, models]) => (
            <div key={provider}>
              <div className="sticky top-0 bg-popover px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {provider}
              </div>
              {models.map((m, i) => renderItem(m, (groupStartIndex.get(provider) ?? 0) + i))}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {l.empty}
            </div>
          )}

        </div>
      </PopoverContent>
    </Popover>
  );
}
