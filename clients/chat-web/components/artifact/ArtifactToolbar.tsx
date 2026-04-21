'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye,
  SplitSquareHorizontal,
  History,
  Sparkles,
  Save,
} from 'lucide-react';
import { useArtifactStore } from '@/store/artifact.store';

interface ArtifactToolbarProps {
  onVersionsClick: () => void;
  onOptimizeClick: () => void;
}

const VIEW_OPTIONS = [
  { key: 'preview', label: '预览', icon: Eye },
  { key: 'split', label: '分屏', icon: SplitSquareHorizontal },
] as const;

export function ArtifactToolbar({
  onVersionsClick,
  onOptimizeClick,
}: ArtifactToolbarProps) {
  const {
    viewMode,
    setViewMode,
    saveArtifact,
    isDirty,
    activeArtifact,
    updateTitle,
  } = useArtifactStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(activeArtifact?.title || '');

  useEffect(() => {
    setTitle(activeArtifact?.title || '');
  }, [activeArtifact?.id, activeArtifact?.title]);

  const handleSaveTitle = async () => {
    if (title !== activeArtifact?.title && title.trim()) {
      await updateTitle(title);
    }
    setIsEditingTitle(false);
  };

  if (!activeArtifact) {
    return null;
  }

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--artifact-bg) 82%, var(--panel))',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            Artifact workspace
          </p>
          {isEditingTitle ? (
            <Input
              aria-label="工件标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setTitle(activeArtifact.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="mt-2 h-11 rounded-full border-0 px-4 text-base"
              style={{
                backgroundColor: 'var(--panel)',
                color: 'var(--foreground)',
                boxShadow: 'inset 0 0 0 1px var(--border)',
              }}
            />
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="truncate text-left text-lg font-semibold transition-opacity hover:opacity-70"
                onClick={() => {
                  setTitle(activeArtifact.title);
                  setIsEditingTitle(true);
                }}
                title="点击编辑标题"
                style={{ color: 'var(--foreground)' }}
              >
                {activeArtifact.title}
              </button>
              {isDirty && <span style={{ color: 'var(--warning)' }}>•</span>}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={!isDirty}
          onClick={saveArtifact}
          title="保存到服务器 (Ctrl+S)"
          className="h-10 rounded-full px-4"
          style={{
            backgroundColor: isDirty ? 'var(--foreground)' : 'var(--panel)',
            color: isDirty ? 'var(--panel)' : 'var(--muted)',
            borderColor: 'var(--border)',
          }}
        >
          <Save className="mr-1.5 h-4 w-4" />
          保存
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-4">
        <div
          className="flex items-center gap-1 rounded-full p-1"
          style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
        >
          {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => {
            const active = viewMode === key;
            return (
              <Button
                key={key}
                size="sm"
                variant="ghost"
                onClick={() => setViewMode(key)}
                className="h-9 rounded-full px-3"
                style={{
                  backgroundColor: active ? 'var(--nav-item-active)' : 'transparent',
                  color: active ? 'var(--foreground)' : 'var(--muted)',
                }}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {label}
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onVersionsClick}
            className="h-9 rounded-full px-3"
            style={{ backgroundColor: 'var(--panel)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            <History className="mr-1.5 h-4 w-4" />
            版本历史
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onOptimizeClick}
            className="h-9 rounded-full px-3"
            style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            AI优化
          </Button>
        </div>
      </div>
    </div>
  );
}
