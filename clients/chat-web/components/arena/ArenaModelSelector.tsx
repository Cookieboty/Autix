'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useArenaStore } from '@/store/arena.store';
import { Globe, ChevronDown, X } from 'lucide-react';

export function ArenaModelSelector() {
  const router = useRouter();
  const {
    availableModels,
    selectedModelIds,
    setSelectedModels,
    fetchAvailableModels,
  } = useArenaStore();
  const [open, setOpen] = useState(false);
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: 'var(--surface)',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
        }}
      >
        <Globe className="w-4 h-4" />
        <span>暂无模型，点击配置</span>
      </button>
    );
  }

  const selectedModels = availableModels.filter((m) =>
    selectedModelIds.includes(m.id),
  );

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {selectedModels.map((model) => (
        <div
          key={model.id}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <span className="max-w-[80px] truncate">{model.name}</span>
          <button
            onClick={() => removeModel(model.id)}
            className="cursor-pointer rounded-full p-0.5 hover:bg-[var(--panel-muted)] transition-colors"
          >
            <X className="h-3 w-3" style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: open ? 'var(--surface)' : 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <Globe className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
        <span>
          {selectedModelIds.length === 0
            ? '选择模型'
            : `${selectedModelIds.length}/4`}
        </span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{
            color: 'var(--muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 w-72 rounded-xl py-1 z-50 shadow-lg"
          style={{
            backgroundColor: 'var(--overlay)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="px-3 pt-2 pb-1.5 text-[10px] font-medium"
            style={{ color: 'var(--muted)' }}
          >
            选择 2-4 个模型进行对比
          </div>

          {(['private', 'public'] as const).map((visibility) => {
            const group = availableModels.filter((m) => m.visibility === visibility);
            if (group.length === 0) return null;
            return (
              <div key={visibility}>
                <div
                  className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}
                >
                  {visibility === 'private' ? '私人模型' : '公开模型'}
                </div>
                {group.map((model) => {
                  const isSelected = selectedModelIds.includes(model.id);
                  const isDisabled = !isSelected && selectedModelIds.length >= 4;
                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        if (!isDisabled) toggleModel(model.id);
                      }}
                      disabled={isDisabled}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
                      }
                    >
                      <div
                        className="flex h-4 w-4 items-center justify-center rounded border flex-shrink-0"
                        style={{
                          borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                          backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                        }}
                      >
                        {isSelected && (
                          <span className="text-[10px] text-white font-bold">✓</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{model.name}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                          {model.model} · {model.provider}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border)' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
