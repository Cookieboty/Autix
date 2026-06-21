import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoProject } from '@autix/shared-store';
import { VideoHistoryProjectCard } from '../../VideoHistoryProjectCard';

export function VideoInspirationHistory({
  projects,
  onSelectProject,
  onReuseProject,
}: {
  projects: VideoProject[];
  onSelectProject: (projectId: string) => void;
  onReuseProject: (projectId: string) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.history');

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
