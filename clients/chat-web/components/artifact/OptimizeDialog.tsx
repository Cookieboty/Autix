'use client';

import { useState } from 'react';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import {
  DialogShell,
  DialogHero,
  DialogBody,
  DialogSection,
  DialogFooterRow,
  DialogTag,
} from '@/components/dialog-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useArtifactStore } from '@/store/artifact.store';

interface OptimizeDialogProps {
  open: boolean;
  onClose: () => void;
}

const CHAT_API =
  process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

const MAX_LENGTH = 500;

export function OptimizeDialog({ open, onClose }: OptimizeDialogProps) {
  const { activeArtifact, setActiveArtifact } = useArtifactStore();
  const [instruction, setInstruction] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const resetState = () => {
    setInstruction('');
    setPreviewContent('');
    setShowPreview(false);
  };

  const handleClose = () => {
    if (isOptimizing) return;
    onClose();
    resetState();
  };

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
              import('@/lib/api').then(({ artifactApi }) => {
                artifactApi.getArtifact(activeArtifact.id).then((response) => {
                  setActiveArtifact(response.data);
                });
              });

              setTimeout(() => {
                onClose();
                resetState();
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

  const charCount = instruction.length;
  const atLimit = charCount >= MAX_LENGTH;

  return (
    <DialogShell
      open={open}
      onClose={handleClose}
      width="lg"
      dismissOnBackdrop={!isOptimizing}
      header={
        <DialogHero
          icon={<Wand2 className="h-5 w-5" strokeWidth={1.75} />}
          eyebrow="Artifact optimize"
          title="AI 优化文档"
          description="基于当前文档生成一版更清晰、更完整的新内容，完成后将创建新版本。"
          meta={
            isOptimizing ? (
              <DialogTag tone="accent">
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                生成中
              </DialogTag>
            ) : null
          }
        />
      }
      footer={
        <DialogFooterRow
          aside={
            showPreview && !isOptimizing
              ? '已生成新版本，将自动应用。'
              : !showPreview
                ? 'AI 将基于当前版本生成优化建议。'
                : null
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isOptimizing}
              >
                {showPreview ? '关闭' : '取消'}
              </Button>
              {!showPreview ? (
                <Button
                  onClick={handleOptimize}
                  disabled={!instruction.trim() || isOptimizing}
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                  开始优化
                </Button>
              ) : null}
            </>
          }
        />
      }
    >
      <DialogBody>
        {!showPreview ? (
          <DialogSection
            title="优化指令"
            description="用一两句话描述你希望 AI 如何调整这份文档。"
          >
            <div className="space-y-2">
              <Textarea
                placeholder="例如：增加更多技术细节、优化语言表达、补充风险评估……"
                value={instruction}
                onChange={(e) =>
                  setInstruction(e.target.value.slice(0, MAX_LENGTH))
                }
                rows={6}
                maxLength={MAX_LENGTH}
                className="resize-none"
              />
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span style={{ color: 'var(--muted)' }}>
                  建议聚焦在一个目标上，效果更好。
                </span>
                <span
                  style={{
                    color: atLimit ? 'var(--danger)' : 'var(--muted)',
                  }}
                >
                  {charCount} / {MAX_LENGTH}
                </span>
              </div>
            </div>
          </DialogSection>
        ) : (
          <DialogSection
            title="优化预览"
            description={
              isOptimizing ? '正在实时生成新版本…' : '优化完成，即将应用。'
            }
          >
            <div
              className="max-h-[52vh] overflow-auto rounded-md px-5 py-4"
              style={{
                backgroundColor: 'var(--panel-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {previewContent ? (
                <div
                  className="artifact-prose"
                  style={{ color: 'var(--foreground)' }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 py-8 text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  <Sparkles
                    className="h-4 w-4 animate-pulse"
                    strokeWidth={1.75}
                  />
                  等待生成优化结果…
                </div>
              )}
            </div>
          </DialogSection>
        )}
      </DialogBody>
    </DialogShell>
  );
}
