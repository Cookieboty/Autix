'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from '../navigation';
import { useTranslations } from 'next-intl';
import { useArenaStore } from '@autix/shared-store';
import {
  type ModelCategory,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  getModelCategory,
} from '@autix/shared-lib';
import { Globe, ChevronDown, X, Settings } from 'lucide-react';
import { ArenaModelParamsDrawer } from './ArenaModelParamsDrawer';

export function ArenaModelSelector() {
  const t = useTranslations('arena');
  const router = useRouter();
  const {
    availableModels,
    selectedModelIds,
    activeCategory,
    setSelectedModels,
    setActiveCategory,
    fetchAvailableModels,
  } = useArenaStore();
  const [open, setOpen] = useState(false);
  const [drawerModelId, setDrawerModelId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAvailableModels();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const modelsByCategory = useMemo(() => {
    const map: Record<ModelCategory, typeof availableModels> = {
      text: [],
      'multimodal-image': [],
      'multimodal-video': [],
    };
    for (const m of availableModels) {
      const cat = getModelCategory(m.capabilities ?? []);
      map[cat].push(m);
    }
    return map;
  }, [availableModels]);

  const categoriesWithModels = ALL_CATEGORIES.filter(
    (c) => modelsByCategory[c].length > 0,
  );

  const filteredModels = modelsByCategory[activeCategory] ?? [];

  const toggleModel = (id: string) => {
    if (selectedModelIds.includes(id)) {
      setSelectedModels(selectedModelIds.filter((m) => m !== id));
    } else if (selectedModelIds.length < 4) {
      setSelectedModels([...selectedModelIds, id]);
    }
  };

  const removeModel = (id: string) => {
    setSelectedModels(selectedModelIds.filter((m) => m !== id));
  };

  if (availableModels.length === 0) {
    return (
      <button
        onClick={() => router.push('/models')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-card text-muted-foreground border border-border"
      >
        <Globe className="w-4 h-4" />
        <span>{t('noModels')}</span>
      </button>
    );
  }

  const selectedModels = availableModels.filter((m) =>
    selectedModelIds.includes(m.id),
  );

  const drawerModel = drawerModelId
    ? availableModels.find((m) => m.id === drawerModelId)
    : null;

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {selectedModels.map((model) => (
        <div
          key={model.id}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-card border border-border text-foreground"
        >
          <span className="max-w-[80px] truncate">{model.name}</span>
          <button
            onClick={() => setDrawerModelId(model.id)}
            className="cursor-pointer rounded-full p-0.5 hover:bg-secondary transition-colors"
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => removeModel(model.id)}
            className="cursor-pointer rounded-full p-0.5 hover:bg-secondary transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-foreground border border-border hover:bg-card ${
          open ? 'bg-card' : 'bg-transparent'
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
        <span>
          {selectedModelIds.length === 0
            ? t('selectModel')
            : `${selectedModelIds.length}/4`}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform text-muted-foreground ${open ? 'rotate-180' : ''}`} />
      </button>

      <ArenaModelParamsDrawer
        modelId={drawerModelId}
        modelName={drawerModel?.name ?? ''}
        capabilities={drawerModel?.capabilities ?? []}
        onClose={() => setDrawerModelId(null)}
      />

      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 rounded-xl py-1 z-50 shadow-lg bg-popover text-popover-foreground border border-border">
          {categoriesWithModels.length > 1 && (
            <div className="flex gap-1 px-3 pt-2 pb-1">
              {categoriesWithModels.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground border border-border'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          <div className="px-3 pt-2 pb-1.5 text-[10px] font-medium text-muted-foreground">
            {t('selectModelsHint')}
          </div>

          {filteredModels.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">
              {t('noCategoryModels')}
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = selectedModelIds.includes(model.id);
              const isDisabled =
                !isSelected && selectedModelIds.length >= 4;
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    if (!isDisabled) toggleModel(model.id);
                  }}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-transparent hover:bg-secondary ${
                    isSelected ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-border bg-transparent'
                    }`}
                  >
                    {isSelected && (
                      <span className="text-[10px] text-primary-foreground font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {model.name}
                    </div>
                    <div className="text-xs truncate text-muted-foreground">
                      {model.model} · {model.provider}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
