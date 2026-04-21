'use client';

import { useEffect, useState } from 'react';
import { History, GitBranch, Sparkles, User, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useArtifactStore } from '@/store/artifact.store';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerTag,
} from '@/components/drawer-shell';
import { Button } from '@/components/ui/button';

interface VersionHistoryProps {
  open: boolean;
  onClose: () => void;
}

function tagTone(tag: string): 'accent' | 'default' | 'success' {
  if (tag === 'AI') return 'accent';
  if (tag === 'HUMAN') return 'success';
  return 'default';
}

function tagIcon(tag: string) {
  if (tag === 'AI') return <Sparkles className="h-3 w-3" strokeWidth={2} />;
  if (tag === 'HUMAN') return <User className="h-3 w-3" strokeWidth={2} />;
  return <GitBranch className="h-3 w-3" strokeWidth={2} />;
}

export function VersionHistory({ open, onClose }: VersionHistoryProps) {
  const { activeArtifact, versions, loadVersions, revertToVersion } =
    useArtifactStore();
  const [revertingVersion, setRevertingVersion] = useState<number | null>(null);

  useEffect(() => {
    if (open && activeArtifact) {
      loadVersions(activeArtifact.id);
    }
  }, [open, activeArtifact, loadVersions]);

  const handleRevert = async (version: number) => {
    if (!confirm(`确定要恢复到版本 ${version} 吗？这将创建一个新版本。`)) return;
    setRevertingVersion(version);
    try {
      await revertToVersion(version);
      onClose();
    } finally {
      setRevertingVersion(null);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width="lg"
      header={
        <DrawerHero
          icon={<History className="h-5 w-5" strokeWidth={1.75} />}
          eyebrow="Version history"
          title="版本历史"
          description={
            activeArtifact ? (
              <>
                {activeArtifact.title}
                {versions.length > 0 ? (
                  <span
                    className="ml-1.5"
                    style={{ color: 'var(--muted)' }}
                  >
                    · {versions.length} 个版本
                  </span>
                ) : null}
              </>
            ) : undefined
          }
        />
      }
    >
      <DrawerBody className="space-y-3">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md"
              style={{
                backgroundColor: 'var(--panel-muted)',
                border: '1px solid var(--border)',
              }}
            >
              <GitBranch
                className="h-5 w-5"
                style={{ color: 'var(--muted)' }}
                strokeWidth={1.75}
              />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              暂无版本历史
            </p>
          </div>
        ) : (
          versions.map((v) => {
            const isCurrent = v.version === activeArtifact?.currentVersion;
            const isReverting = revertingVersion === v.version;
            return (
              <article
                key={v.id}
                className="rounded-md p-4"
                style={{
                  backgroundColor: isCurrent ? 'var(--panel)' : 'var(--panel-muted)',
                  border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--foreground)' }}
                      >
                        版本 {v.version}
                      </span>
                      {isCurrent ? (
                        <DrawerTag tone="accent">当前</DrawerTag>
                      ) : null}
                      {v.sourcetags?.map((tag) => (
                        <DrawerTag key={tag} tone={tagTone(tag)}>
                          {tagIcon(tag)}
                          {tag}
                        </DrawerTag>
                      ))}
                    </div>
                    <p
                      className="text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: 'var(--muted)' }}
                    >
                      {formatDistanceToNow(new Date(v.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </p>
                    {v.changelog ? (
                      <p
                        className="text-sm leading-6"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {v.changelog}
                      </p>
                    ) : null}
                  </div>

                  {!isCurrent ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevert(v.version)}
                      disabled={isReverting}
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                      {isReverting ? '恢复中…' : '恢复'}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </DrawerBody>
    </DrawerShell>
  );
}
