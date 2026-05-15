'use client';

import { Plus, LayoutTemplate } from 'lucide-react';
import { Button } from '../ui/button';

interface VideoEmptyStateProps {
  onCreateProject: () => void;
  onOpenTemplates: () => void;
}

export function VideoEmptyState({ onCreateProject, onOpenTemplates }: VideoEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <svg className="size-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">开始视频创作</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          创建新项目或从模板开始，添加素材和提示词生成视频片段
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onCreateProject} className="gap-2">
          <Plus className="size-4" />
          新建项目
        </Button>
        <Button variant="outline" onClick={onOpenTemplates} className="gap-2">
          <LayoutTemplate className="size-4" />
          从模板开始
        </Button>
      </div>
    </div>
  );
}
