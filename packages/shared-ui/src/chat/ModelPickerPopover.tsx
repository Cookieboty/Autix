'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { ModelConfigItem } from '@autix/shared-lib';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface ModelPickerPopoverProps {
  candidates: ModelConfigItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  memoryKey: string;
  trigger: React.ReactNode;
  disabledClear?: boolean;
  labels?: {
    searchPlaceholder?: string;
    recent?: string;
    empty?: string;
    clearSelection?: string;
  };
}

const RECENT_MAX = 5;

function getRecentIds(memoryKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`modelPicker.recent.${memoryKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function addRecentId(memoryKey: string, id: string) {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentIds(memoryKey).filter((r) => r !== id);
    recent.unshift(id);
    window.localStorage.setItem(
      `modelPicker.recent.${memoryKey}`,
      JSON.stringify(recent.slice(0, RECENT_MAX)),
    );
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export function ModelPickerPopover({
  candidates,
  value,
  onChange,
  placeholder = '选择模型',
  memoryKey,
  trigger,
  disabledClear = true,
  labels,
}: ModelPickerPopoverProps) {
  const l = {
    searchPlaceholder: labels?.searchPlaceholder ?? '搜索模型名 / 供应商',
    recent: labels?.recent ?? '最近使用',
    empty: labels?.empty ?? '无匹配模型',
    clearSelection: labels?.clearSelection ?? '清除选择（使用默认）',
  };
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

  const recentIds = useMemo(() => (open ? getRecentIds(memoryKey) : []), [open, memoryKey]);

  const recentModels = useMemo(
    () => recentIds.map((id) => candidates.find((m) => m.id === id)).filter(Boolean) as ModelConfigItem[],
    [recentIds, candidates],
  );

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
    if (!search.trim() && recentModels.length > 0) items.push(...recentModels);
    for (const [, models] of grouped) items.push(...models);
    return items;
  }, [search, recentModels, grouped]);

  const handleSelect = (id: string) => {
    onChange(id);
    addRecentId(memoryKey, id);
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
    if (!search.trim() && recentModels.length > 0) {
      cursor += recentModels.length;
    }
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
            placeholder={l.searchPlaceholder}
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[calc(70vh-48px)] overflow-y-auto" role="listbox">
          {/* Recent */}
          {!search.trim() && recentModels.length > 0 && (
            <>
              <div className="sticky top-0 bg-popover px-3 py-1.5 text-xs font-medium text-muted-foreground">
                ★ {l.recent}
              </div>
              {recentModels.map((m, i) => renderItem(m, i))}
            </>
          )}

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

          {/* Clear selection */}
          {!disabledClear && value && (
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
              >
                <X className="size-3.5" /> {l.clearSelection}
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
