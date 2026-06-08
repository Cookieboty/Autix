'use client';

import { useEffect } from 'react';
import { Film, CheckCircle2, Loader2, AlertCircle, Clock, Plus, X } from 'lucide-react';
import { useVideoProjectStore, type VideoClip, type VideoProject } from '@autix/shared-store';
import { Button } from '../ui/button';

interface VideoClipSidebarProps {
  conversationId: string;
  onClose?: () => void;
}

export function VideoClipSidebar({ conversationId, onClose }: VideoClipSidebarProps) {
  const { project, projects, loadProjects, loadProject, createProject, selectedClipId, selectClip, addClip } =
    useVideoProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium">视频项目</h3>
        {onClose && (
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {!project ? (
        <ProjectList
          projects={projects}
          onSelect={(id) => loadProject(id)}
          onCreate={async () => { await createProject('未命名项目'); }}
        />
      ) : (
        <ClipList
          project={project}
          selectedClipId={selectedClipId}
          onSelectClip={selectClip}
          onAddClip={async () => { await addClip({ params: {}, chainFromPrev: (project.clips.length ?? 0) > 0 }); }}
          onBack={() => useVideoProjectStore.getState().setProject(null)}
        />
      )}
    </div>
  );
}

function ProjectList({
  projects,
  onSelect,
  onCreate,
}: {
  projects: VideoProject[];
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      <Button variant="outline" size="sm" className="w-full gap-1 text-xs mb-2" onClick={onCreate}>
        <Plus className="size-3.5" />
        新建项目
      </Button>

      {projects.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-6">暂无项目</p>
      )}

      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors"
          onClick={() => onSelect(p.id)}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
            {p.coverImage ? (
              <img src={p.coverImage} alt="" className="size-8 rounded object-cover" />
            ) : (
              <Film className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{p.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {p.clips?.length ?? 0} clips
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ClipStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-3 text-green-500" />;
    case 'generating':
      return <Loader2 className="size-3 animate-spin text-foreground" />;
    case 'failed':
      return <AlertCircle className="size-3 text-destructive" />;
    default:
      return <Clock className="size-3 text-muted-foreground" />;
  }
}

function ClipList({
  project,
  selectedClipId,
  onSelectClip,
  onAddClip,
  onBack,
}: {
  project: VideoProject;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onAddClip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          ← 返回
        </button>
        <span className="text-xs font-medium truncate flex-1">{project.title}</span>
      </div>

      <div className="p-2 space-y-1">
        {project.clips.map((clip, idx) => (
          <button
            key={clip.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
              selectedClipId === clip.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent'
            }`}
            onClick={() => onSelectClip(clip.id)}
          >
            <ClipStatusIcon status={clip.status} />
            <span className="text-xs flex-1 truncate">{clip.title || `Clip ${idx + 1}`}</span>
            <span className="text-[10px] text-muted-foreground">
              {(clip.params as any)?.duration ?? 5}s
            </span>
          </button>
        ))}

        <Button variant="ghost" size="sm" className="w-full gap-1 text-xs mt-1" onClick={onAddClip}>
          <Plus className="size-3.5" />
          添加 Clip
        </Button>
      </div>

      {project.clips.length > 0 && (
        <div className="border-t border-border p-2">
          <p className="text-[10px] text-muted-foreground mb-1">生成记录</p>
          {project.clips.flatMap((c) => c.generations).length === 0 ? (
            <p className="text-[10px] text-muted-foreground">暂无记录</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {project.clips
                .flatMap((c) => c.generations.map((g) => ({ ...g, clipTitle: c.title })))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map((gen) => (
                  <div key={gen.id} className="flex items-center gap-1.5 text-[10px]">
                    <ClipStatusIcon status={gen.status} />
                    <span className="truncate flex-1 text-muted-foreground">
                      {gen.clipTitle || 'Clip'} — {gen.status}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
