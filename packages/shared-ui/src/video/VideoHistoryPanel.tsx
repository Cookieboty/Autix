'use client';

import { useEffect } from 'react';
import { X, Film } from 'lucide-react';
import { useVideoProjectStore, type VideoProject } from '@autix/shared-store';

interface VideoHistoryPanelProps {
  onClose: () => void;
  onSelectProject?: (projectId: string) => void;
}

function groupByDate(projects: VideoProject[]): Record<string, VideoProject[]> {
  const groups: Record<string, VideoProject[]> = {};
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const p of projects) {
    const d = new Date(p.createdAt).toDateString();
    let label: string;
    if (d === today) label = '今天';
    else if (d === yesterday) label = '昨天';
    else label = new Date(p.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(p);
  }
  return groups;
}

export function VideoHistoryPanel({ onClose, onSelectProject }: VideoHistoryPanelProps) {
  const { projects, loadProjects, loadProject } = useVideoProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const groups = groupByDate(projects);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium">历史记录</h3>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.keys(groups).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">暂无历史记录</p>
        )}

        {Object.entries(groups).map(([label, items]) => (
          <div key={label} className="space-y-1">
            <p className="px-2 text-[10px] font-medium text-muted-foreground uppercase">{label}</p>
            {items.map((project) => (
              <button
                key={project.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors"
                onClick={() => {
                  if (onSelectProject) {
                    onSelectProject(project.id);
                    return;
                  }
                  void loadProject(project.id);
                }}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
                  {project.coverImage ? (
                    <img src={project.coverImage} alt="" className="size-8 rounded object-cover" />
                  ) : (
                    <Film className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{project.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {project.clips?.length ?? 0} clips
                  </p>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
