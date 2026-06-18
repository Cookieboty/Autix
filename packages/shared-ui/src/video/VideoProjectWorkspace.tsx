'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useVideoProjectStore } from '@autix/shared-store';
import { VideoEmptyState } from './VideoEmptyState';
import { VideoPreview } from './VideoPreview';
import { ClipTimeline } from './ClipTimeline';
import { ClipEditor } from './ClipEditor';
import { AIDirectorChat } from './AIDirectorChat';
import { VideoHistoryPanel } from './VideoHistoryPanel';
import { VideoTemplatePickerSheet } from './VideoTemplatePickerSheet';

interface VideoProjectWorkspaceProps {
  conversationId: string;
  userId?: string;
  onSendDirectorMessage?: (message: string) => void;
}

export function VideoProjectWorkspace({
  conversationId,
  onSendDirectorMessage,
}: VideoProjectWorkspaceProps) {
  const t = useTranslations('videoWorkbench.legacy.projectWorkspace');
  const { project, loading, loadProjects, createProject, selectClip, selectedClipId } =
    useVideoProjectStore();
  const { projects, loadProject } = useVideoProjectStore();

  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (project?.conversationId === conversationId) return;
    const matched = projects.find((item) => item.conversationId === conversationId);
    if (matched) {
      void loadProject(matched.id);
    }
  }, [conversationId, loadProject, project?.conversationId, projects]);

  const handleCreateProject = useCallback(async () => {
    await createProject(t('defaultProjectTitle'), conversationId);
  }, [conversationId, createProject, t]);

  const selectedClip = project?.clips.find((c) => c.id === selectedClipId) ?? null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
      </div>
    );
  }

  if (!project) {
    return (
      <>
        <VideoEmptyState
          onCreateProject={handleCreateProject}
          onOpenTemplates={() => setTemplateSheetOpen(true)}
        />
        <VideoTemplatePickerSheet
          open={templateSheetOpen}
          onOpenChange={setTemplateSheetOpen}
          conversationId={conversationId}
        />
      </>
    );
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <VideoPreview clip={selectedClip} />
          <ClipTimeline
            clips={project.clips}
            selectedClipId={selectedClipId}
            onSelectClip={selectClip}
          />
          <ClipEditor clip={selectedClip} projectId={project.id} />
        </div>

        <AIDirectorChat
          conversationId={conversationId}
          onSend={onSendDirectorMessage}
          onDone={() => {
            if (project?.id) void loadProject(project.id);
          }}
        />
      </div>

      {historyOpen && (
        <div className="w-[360px] shrink-0 border-l border-border overflow-y-auto">
          <VideoHistoryPanel onClose={() => setHistoryOpen(false)} />
        </div>
      )}

      {!historyOpen && (
        <button
          type="button"
          className="absolute right-2 top-14 z-10 inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={() => setHistoryOpen(true)}
          title={t('historyTitle')}
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        </button>
      )}

      <VideoTemplatePickerSheet
        open={templateSheetOpen}
        onOpenChange={setTemplateSheetOpen}
        conversationId={conversationId}
      />
    </div>
  );
}
