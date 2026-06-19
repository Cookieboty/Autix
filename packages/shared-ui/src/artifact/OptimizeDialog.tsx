'use client';

import { useState } from 'react';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslations } from 'next-intl';
import {
  DialogShell,
  DialogHero,
  DialogShellBody,
  DialogSection,
  DialogFooterRow,
  DialogTag,
} from '../dialog-shell';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useArtifactStore } from '@autix/shared-store';
import { getApiBaseUrl, artifactApi } from '@autix/sdk';
import { authFetchEventSource } from '../hooks/authFetchEventSource';

interface OptimizeDialogProps {
  open: boolean;
  onClose: () => void;
}

const MAX_LENGTH = 500;

export function OptimizeDialog({ open, onClose }: OptimizeDialogProps) {
  const t = useTranslations('artifact');
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

    try {
      await authFetchEventSource(
        `${getApiBaseUrl()}/api/artifacts/${activeArtifact.id}/optimize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ instruction }),

          onmessage(ev) {
            const data = JSON.parse(ev.data);

            if (data.type === 'markdown') {
              setPreviewContent((prev) => prev + data.content);
            } else if (data.type === 'done') {
              setIsOptimizing(false);
              artifactApi.getArtifact(activeArtifact.id).then((response) => {
                setActiveArtifact(response.data);
              });

              setTimeout(() => {
                onClose();
                resetState();
              }, 1500);
            } else if (data.type === 'error') {
              console.error('Optimization failed:', data.message);
              setIsOptimizing(false);
            }
          },

          onerror(err) {
            console.error('Connection interrupted:', err);
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
          eyebrow={t('optimizeEyebrow')}
          title={t('optimizeTitle')}
          description={t('optimizeDescription')}
          meta={
            isOptimizing ? (
              <DialogTag tone="accent">
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                {t('generating')}
              </DialogTag>
            ) : null
          }
        />
      }
      footer={
        <DialogFooterRow
          aside={
            showPreview && !isOptimizing
              ? t('generatedNewVersion')
              : !showPreview
                ? t('aiWillOptimize')
                : null
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isOptimizing}
              >
                {showPreview ? t('closeLabel') : t('cancelLabel')}
              </Button>
              {!showPreview ? (
                <Button
                  onClick={handleOptimize}
                  disabled={!instruction.trim() || isOptimizing}
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                  {t('startOptimize')}
                </Button>
              ) : null}
            </>
          }
        />
      }
    >
      <DialogShellBody>
        {!showPreview ? (
          <DialogSection
            title={t('optimizeInstruction')}
            description={t('optimizeInstructionDesc')}
          >
            <div className="space-y-2">
              <Textarea
                placeholder={t('optimizePlaceholder')}
                value={instruction}
                onChange={(e) =>
                  setInstruction(e.target.value.slice(0, MAX_LENGTH))
                }
                rows={6}
                maxLength={MAX_LENGTH}
                className="resize-none"
              />
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="text-muted-foreground">
                  {t('focusTip')}
                </span>
                <span className={atLimit ? 'text-destructive' : 'text-muted-foreground'}>
                  {charCount} / {MAX_LENGTH}
                </span>
              </div>
            </div>
          </DialogSection>
        ) : (
          <DialogSection
            title={t('optimizePreview')}
            description={
              isOptimizing ? t('generatingNewVersion') : t('optimizeDone')
            }
          >
            <div className="max-h-[52vh] overflow-auto rounded-md px-5 py-4 bg-secondary border border-border">
              {previewContent ? (
                <div className="artifact-prose text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Sparkles
                    className="h-4 w-4 animate-pulse"
                    strokeWidth={1.75}
                  />
                  {t('waitingForResult')}
                </div>
              )}
            </div>
          </DialogSection>
        )}
      </DialogShellBody>
    </DialogShell>
  );
}
