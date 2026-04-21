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
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--artifact-bg)',
      }}
    >
      <ArtifactToolbar
        onVersionsClick={() => setShowVersions(true)}
        onOptimizeClick={() => setShowOptimize(true)}
      />

      <div className="w-full flex-1 overflow-hidden" style={{ minWidth: 0 }}>
        {viewMode === 'preview' && <ArtifactViewer />}
        {viewMode === 'split' && (
          <Group orientation="horizontal" className="h-full w-full">
            <Panel
              defaultSize="50%"
              minSize="30%"
              style={{ minWidth: 0, overflow: 'hidden' }}
            >
              <ArtifactEditor />
            </Panel>
            <Separator
              style={{
                flexBasis: '12px',
                width: '12px',
                cursor: 'col-resize',
                background: 'transparent',
                zIndex: 1,
                userSelect: 'none',
              }}
            />
            <Panel
              defaultSize="50%"
              minSize="30%"
              style={{ minWidth: 0, overflow: 'hidden' }}
            >
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
