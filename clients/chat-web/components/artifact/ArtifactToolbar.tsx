'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye,
  Edit,
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
    <div className="flex flex-col border-b bg-background">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-3 border-b">
        {isEditingTitle ? (
          <Input
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
            className="flex-1 mr-2"
          />
        ) : (
          <h2
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => {
              setTitle(activeArtifact.title);
              setIsEditingTitle(true);
            }}
            title="点击编辑标题"
          >
            {activeArtifact.title}
            {isDirty && <span className="text-orange-500 ml-1">*</span>}
          </h2>
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between p-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={viewMode === 'preview' ? 'default' : 'ghost'}
            onClick={() => setViewMode('preview')}
          >
            <Eye className="w-4 h-4 mr-1" />
            预览
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'edit' ? 'default' : 'ghost'}
            onClick={() => setViewMode('edit')}
          >
            <Edit className="w-4 h-4 mr-1" />
            编辑
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'split' ? 'default' : 'ghost'}
            onClick={() => setViewMode('split')}
          >
            <SplitSquareHorizontal className="w-4 h-4 mr-1" />
            分屏
          </Button>
        </div>

        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onVersionsClick}>
            <History className="w-4 h-4 mr-1" />
            版本历史
          </Button>

          <Button size="sm" variant="secondary" onClick={onOptimizeClick}>
            <Sparkles className="w-4 h-4 mr-1" />
            AI优化
          </Button>

          <Button
            size="sm"
            variant="default"
            disabled={!isDirty}
            onClick={saveArtifact}
            title="保存到服务器 (Ctrl+S)"
          >
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
