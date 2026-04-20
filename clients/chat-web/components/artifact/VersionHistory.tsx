'use client';

import { useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useArtifactStore } from '@/store/artifact.store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface VersionHistoryProps {
  open: boolean;
  onClose: () => void;
}

export function VersionHistory({ open, onClose }: VersionHistoryProps) {
  const { activeArtifact, versions, loadVersions, revertToVersion } =
    useArtifactStore();

  useEffect(() => {
    if (open && activeArtifact) {
      loadVersions(activeArtifact.id);
    }
  }, [open, activeArtifact, loadVersions]);

  // 获取标签颜色
  const getTagColor = (tag: string) => {
    if (tag === 'AI') return 'default';
    if (tag === 'HUMAN') return 'secondary';
    return 'outline';
  };

  const handleRevert = async (version: number) => {
    if (confirm(`确定要恢复到版本 ${version} 吗？这将创建一个新版本。`)) {
      await revertToVersion(version);
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>版本历史</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          {versions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              暂无版本历史
            </div>
          ) : (
            versions.map((v) => (
              <Card key={v.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* 显示所有标签 */}
                    <div className="flex gap-2 mb-2">
                      {v.sourcetags?.map((tag) => (
                        <Badge key={tag} variant={getTagColor(tag)}>
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-sm font-medium">版本 {v.version}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(v.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </p>
                    {v.changelog && (
                      <p className="text-sm mt-2 text-muted-foreground">
                        {v.changelog}
                      </p>
                    )}
                  </div>

                  {v.version !== activeArtifact?.currentVersion && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevert(v.version)}
                    >
                      恢复
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
