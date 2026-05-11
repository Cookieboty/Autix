'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Eye,
  SplitSquareHorizontal,
  History,
  Sparkles,
  Save,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useArtifactStore } from '@autix/shared-store';

interface ArtifactToolbarProps {
  onVersionsClick: () => void;
  onOptimizeClick: () => void;
}

const VIEW_OPTIONS = [
  { key: 'preview', labelKey: 'preview', icon: Eye },
  { key: 'split', labelKey: 'split', icon: SplitSquareHorizontal },
] as const;

export function ArtifactToolbar({
  onVersionsClick,
  onOptimizeClick,
}: ArtifactToolbarProps) {
  const t = useTranslations('artifact');
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
    <div className="flex flex-col bg-card border-b border-border">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t('workspace')}
          </p>
          {isEditingTitle ? (
            <Input
              aria-label={t('artifactTitle')}
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
              className="mt-2 h-11 rounded-full border-0 px-4 text-base bg-card text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
            />
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="truncate text-left text-lg font-semibold text-foreground transition-opacity hover:opacity-70"
                onClick={() => {
                  setTitle(activeArtifact.title);
                  setIsEditingTitle(true);
                }}
                title={t('clickToEditTitle')}
              >
                {activeArtifact.title}
              </button>
              {isDirty && <span className="text-warning">•</span>}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={!isDirty}
          onClick={saveArtifact}
          title={t('saveToServer')}
          className={`h-10 rounded-full px-4 border-border ${
            isDirty ? 'bg-foreground text-card' : 'bg-card text-muted-foreground'
          }`}
        >
          <Save className="mr-1.5 h-4 w-4" />
          {t('save')}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-4">
        <div className="flex items-center gap-1 rounded-full p-1 bg-card border border-border">
          {VIEW_OPTIONS.map(({ key, labelKey, icon: Icon }) => {
            const active = viewMode === key;
            return (
              <Button
                key={key}
                size="sm"
                variant="ghost"
                onClick={() => setViewMode(key)}
                className={`h-9 rounded-full px-3 ${
                  active ? 'bg-accent text-foreground' : 'bg-transparent text-muted-foreground'
                }`}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {t(labelKey)}
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onVersionsClick}
            className="h-9 rounded-full px-3 bg-card text-foreground border border-border"
          >
            <History className="mr-1.5 h-4 w-4" />
            {t('versionHistory')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onOptimizeClick}
            className="h-9 rounded-full px-3 bg-secondary text-foreground border border-border"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {t('aiOptimize')}
          </Button>
        </div>
      </div>
    </div>
  );
}
