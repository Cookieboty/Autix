'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useArtifactStore } from '@/store/artifact.store';
import ReactMarkdown from 'react-markdown';
import { fetchEventSource } from '@microsoft/fetch-event-source';

interface OptimizeDialogProps {
  open: boolean;
  onClose: () => void;
}

const CHAT_API =
  process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

export function OptimizeDialog({ open, onClose }: OptimizeDialogProps) {
  const { activeArtifact, setActiveArtifact } = useArtifactStore();
  const [instruction, setInstruction] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleOptimize = async () => {
    if (!instruction.trim() || !activeArtifact) return;

    setIsOptimizing(true);
    setPreviewContent('');
    setShowPreview(true);

    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    try {
      await fetchEventSource(
        `${CHAT_API}/api/artifacts/${activeArtifact.id}/optimize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ instruction }),

          onmessage(ev) {
            const data = JSON.parse(ev.data);

            if (data.type === 'markdown') {
              setPreviewContent((prev) => prev + data.content);
            } else if (data.type === 'done') {
              setIsOptimizing(false);
              // 刷新产物
              import('@/lib/api').then(({ artifactApi }) => {
                artifactApi.getArtifact(activeArtifact.id).then((response) => {
                  setActiveArtifact(response.data);
                });
              });

              setTimeout(() => {
                onClose();
                setInstruction('');
                setPreviewContent('');
                setShowPreview(false);
              }, 1500);
            } else if (data.type === 'error') {
              console.error('优化失败:', data.message);
              setIsOptimizing(false);
            }
          },

          onerror(err) {
            console.error('连接中断:', err);
            setIsOptimizing(false);
            throw err;
          },
        },
      );
    } catch (error) {
      console.error('Optimize error:', error);
      setIsOptimizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>AI 优化文档</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {!showPreview ? (
            <div className="space-y-4">
              <Textarea
                placeholder="例如：增加更多技术细节、优化语言表达、补充风险评估..."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                AI 将基于当前版本进行优化，并创建新版本
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">优化预览</h3>
                {isOptimizing && (
                  <Badge variant="default">
                    <span className="animate-pulse">生成中...</span>
                  </Badge>
                )}
              </div>
              <div className="border rounded-lg p-4 max-h-96 overflow-auto bg-muted/50 prose prose-sm dark:prose-invert max-w-none">
                {previewContent ? (
                  <ReactMarkdown>{previewContent}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground">等待生成...</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isOptimizing}>
            {showPreview ? '关闭' : '取消'}
          </Button>
          {!showPreview && (
            <Button
              onClick={handleOptimize}
              disabled={!instruction.trim() || isOptimizing}
            >
              开始优化
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
