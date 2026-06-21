import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoProject } from '@autix/shared-store';
import { VideoHistoryProjectCard } from '../../VideoHistoryProjectCard';
import { VideoHistoryProjectDetail } from './VideoHistoryProjectDetail';

export function VideoInspirationHistory({
  projects,
  onSelectProject,
  onReuseProject,
  detailProjectId,
  onBackToList,
}: {
  projects: VideoProject[];
  onSelectProject: (projectId: string) => void;
  onReuseProject: (projectId: string) => void;
  detailProjectId: string | null;
  onBackToList: () => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.history');
  const detailProject = projects.find((project) => project.id === detailProjectId) ?? null;

  if (detailProject) {
    return (
      <VideoHistoryProjectDetail
        project={detailProject}
        onBack={onBackToList}
        onReuse={onReuseProject}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <History className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">{t('empty')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <VideoHistoryProjectCard
          key={project.id}
          project={project}
          onSelectProject={onSelectProject}
          onReuseProject={onReuseProject}
        />
      ))}
    </div>
  );
}
