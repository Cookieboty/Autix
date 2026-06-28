'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useVideoProjectStore, type VideoProject } from '@autix/shared-store';
import { VideoInspirationHistory } from '../../../video/workbench/dialogs/VideoInspirationHistory';

interface VideoHistoryPanelProps {
  onSelectProject: (project: VideoProject) => void;
}

export function VideoHistoryPanel({ onSelectProject }: VideoHistoryPanelProps) {
  const projects = useVideoProjectStore((s) => s.projects);
  const loading = useVideoProjectStore((s) => s.loading);
  const loadProjects = useVideoProjectStore((s) => s.loadProjects);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadProjects();
  }, [loadProjects]);

  const handleSelect = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) onSelectProject(project);
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <VideoInspirationHistory
      projects={projects}
      onSelectProject={handleSelect}
      onReuseProject={handleSelect}
    />
  );
}
