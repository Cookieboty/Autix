'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useVideoProjectStore, type VideoProject } from '@autix/shared-store';
import { toast } from 'sonner';
import { VideoHistoryProjectCard } from './VideoHistoryProjectCard';
import { VideoHistoryProjectDetail } from './workbench/dialogs/VideoHistoryProjectDetail';
import { buildReusableVideoProject } from './workbench/video-history-reuse';

interface VideoHistoryPanelProps {
  onClose: () => void;
  onSelectProject?: (projectId: string) => void;
}

function groupByDate(
  projects: VideoProject[],
  locale: string,
  labels: { today: string; yesterday: string },
): Record<string, VideoProject[]> {
  const groups: Record<string, VideoProject[]> = {};
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const p of projects) {
    const d = new Date(p.createdAt).toDateString();
    let label: string;
    if (d === today) label = labels.today;
    else if (d === yesterday) label = labels.yesterday;
    else label = new Date(p.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(p);
  }
  return groups;
}

export function VideoHistoryPanel({ onClose, onSelectProject }: VideoHistoryPanelProps) {
  const t = useTranslations('videoWorkbench.legacy.historyPanel');
  const locale = useLocale();
  const { projects, loadProjects, replaceDraftProject, deleteProject: deleteStoredProject } =
    useVideoProjectStore();
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const groups = groupByDate(projects, locale, {
    today: t('today'),
    yesterday: t('yesterday'),
  });

  const deleteProject = async (projectId: string) => {
    try {
      await deleteStoredProject(projectId);
      toast.success(t('deleteSuccess'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deleteFailed'));
    }
  };
  const detailProject = projects.find((project) => project.id === detailProjectId) ?? null;
  const reuseProject = (projectId: string) => {
    const source = projects.find((project) => project.id === projectId);
    if (!source) return;
    replaceDraftProject(buildReusableVideoProject(source));
    onClose();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <button
          type="button"
          aria-label={t('close')}
          className="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {detailProject ? (
          <VideoHistoryProjectDetail
            project={detailProject}
            onBack={() => setDetailProjectId(null)}
            onReuse={reuseProject}
          />
        ) : (
          <>
        {Object.keys(groups).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">{t('empty')}</p>
        )}

        {Object.entries(groups).map(([label, items]) => (
          <div key={label} className="space-y-1">
            <p className="px-2 text-[10px] font-medium text-muted-foreground uppercase">{label}</p>
            {items.map((project) => (
              <VideoHistoryProjectCard
                key={project.id}
                project={project}
                compact
                onSelectProject={(projectId) => {
                  if (onSelectProject) {
                    onSelectProject(projectId);
                    return;
                  }
                  setDetailProjectId(projectId);
                }}
                onReuseProject={reuseProject}
                onDeleteProject={(projectId) => void deleteProject(projectId)}
              />
            ))}
          </div>
        ))}
          </>
        )}
      </div>
    </div>
  );
}
