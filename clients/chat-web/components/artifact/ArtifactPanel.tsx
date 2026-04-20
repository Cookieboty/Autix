'use client';

import { useState } from 'react';
import { useArtifactStore } from '@/store/artifact.store';
import { ArtifactToolbar } from './ArtifactToolbar';
import { ArtifactViewer } from './ArtifactViewer';
import { ArtifactEditor } from './ArtifactEditor';
import { VersionHistory } from './VersionHistory';
import { OptimizeDialog } from './OptimizeDialog';
import { Panel, Group, Separator } from 'react-resizable-panels';

export function ArtifactPanel() {
  const { viewMode } = useArtifactStore();
  const [showVersions, setShowVersions] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);

  return (
    <div className="h-full flex flex-col border-l bg-background">
      <ArtifactToolbar
        onVersionsClick={() => setShowVersions(true)}
        onOptimizeClick={() => setShowOptimize(true)}
      />

      <div className="flex-1 overflow-hidden">
        {viewMode === 'preview' && <ArtifactViewer />}
        {viewMode === 'edit' && <ArtifactEditor />}
        {viewMode === 'split' && (
          <Group>
            <Panel defaultSize={50} minSize={30}>
              <ArtifactEditor />
            </Panel>
            <Separator className="w-1 bg-border hover:bg-primary transition-colors" />
            <Panel defaultSize={50} minSize={30}>
              <ArtifactViewer />
            </Panel>
          </Group>
        )}
      </div>

      {showVersions && (
        <VersionHistory
          open={showVersions}
          onClose={() => setShowVersions(false)}
        />
      )}

      {showOptimize && (
        <OptimizeDialog
          open={showOptimize}
          onClose={() => setShowOptimize(false)}
        />
      )}
    </div>
  );
}
