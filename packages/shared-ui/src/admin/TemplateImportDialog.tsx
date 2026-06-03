'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { X, Loader2, Upload, FileJson } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Step = 'upload' | 'select' | 'importing' | 'done';

interface ImportResult {
  imported: number;
  failed: number;
  skipped: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  importFn: (items: Record<string, any>[]) => Promise<{ jobId: string }>;
  pollJob: (
    jobId: string,
  ) => Promise<{ status: string; processed: number; failed: number; total: number }>;
  template?: Record<string, any>[];
  tNamespace?: string;
}

export function TemplateImportDialog({
  open,
  onClose,
  onImported,
  importFn,
  pollJob,
  template,
  tNamespace = 'templateReview',
}: Props) {
  const t = useTranslations(tNamespace);
  const tCommon = useTranslations('common');

  const [step, setStep] = useState<Step>('upload');
  const [allItems, setAllItems] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setAllItems([]);
    setSelected(new Set());
    setResult(null);
    setError('');
    setDragging(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseJsonContent = useCallback((text: string) => {
    try {
      const json = JSON.parse(text);
      const items = Array.isArray(json) ? json : [json];
      if (items.length === 0) {
        setError('JSON is empty');
        return;
      }
      setAllItems(items);
      setSelected(new Set(items.map((_: any, i: number) => i)));
      setError('');
      setStep('select');
    } catch {
      setError('Invalid JSON');
    }
  }, []);

  const readFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        setError('Only .json files supported');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        parseJsonContent(event.target?.result as string);
      };
      reader.readAsText(file);
    },
    [parseJsonContent],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  // Paste support: listen for Ctrl+V / Cmd+V when dialog is open on upload step
  useEffect(() => {
    if (!open || step !== 'upload') return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            readFile(file);
            return;
          }
        }
        if (item.kind === 'string' && item.type === 'text/plain') {
          e.preventDefault();
          item.getAsString((text) => parseJsonContent(text));
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open, step, readFile, parseJsonContent]);

  const toggleItem = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === allItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allItems.map((_: any, i: number) => i)));
    }
  };

  const doImport = async () => {
    const itemsToImport = allItems.filter((_, i) => selected.has(i));
    if (itemsToImport.length === 0) return;
    const skipped = allItems.length - itemsToImport.length;

    setStep('importing');
    try {
      const res = await importFn(itemsToImport);

      const maxAttempts = 120;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const job = await pollJob(res.jobId);
        if (job.status === 'done' || job.status === 'error') {
          setResult({ imported: job.processed, failed: job.failed, skipped });
          setStep('done');
          if (job.processed > 0) onImported();
          return;
        }
      }
      setError('Import timed out');
      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error');
      setStep('done');
    }
  };

  const downloadTemplate = () => {
    const sample =
      template && template.length > 0
        ? template
        : [
            {
              title: '',
              description: '',
              category: '',
              prompt: '',
              variables: {},
              coverImage: '',
              exampleImages: [],
              modelHint: '',
              tags: [],
              pointsCost: 0,
            },
          ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div
          className="pointer-events-auto w-full max-w-2xl max-h-[80vh] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between h-14 px-6 border-b border-border shrink-0">
            <h3 className="text-base font-semibold text-foreground">
              {t('importDialogTitle')}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="p-0 w-8 h-8"
              onClick={handleClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'upload' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div
                  ref={dropRef}
                  className={`w-full max-w-sm h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                    dragging
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload
                    className={`w-8 h-8 transition-colors ${dragging ? 'text-primary' : 'text-foreground/30'}`}
                  />
                  <p className="text-sm text-foreground/50 text-center px-4">
                    {t('importUpload')}
                  </p>
                  <p className="text-xs text-foreground/30">
                    拖拽文件到此处 / 粘贴 JSON 内容
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                  <FileJson className="w-4 h-4 mr-1" />
                  {t('downloadTemplate')}
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}

            {step === 'select' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/60">
                    {t('templatesFound', { count: allItems.length })}
                  </p>
                  <Button size="sm" variant="ghost" onClick={toggleAll}>
                    {selected.size === allItems.length
                      ? t('deselectAll')
                      : t('selectAll')}
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {allItems.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => toggleItem(index)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        selected.has(index)
                          ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
                          : 'border-border hover:border-foreground/20 opacity-60'
                      }`}
                    >
                      <Checkbox
                        checked={selected.has(index)}
                        onCheckedChange={() => toggleItem(index)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.title || `Template ${index + 1}`}
                        </p>
                        <p className="text-xs text-foreground/40">
                          {item.category || '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-foreground/20" />
                <p className="text-sm text-foreground/60">{t('importing')}</p>
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                {result ? (
                  <>
                    <p className="text-base font-semibold text-foreground">
                      {t('importDone')}
                    </p>
                    {result.imported > 0 && (
                      <p className="text-sm text-green-500">
                        {t('importSuccess', { count: result.imported })}
                      </p>
                    )}
                    {result.failed > 0 && (
                      <p className="text-sm text-destructive">
                        {t('importFailed', { count: result.failed })}
                      </p>
                    )}
                    {result.skipped > 0 && (
                      <p className="text-sm text-foreground/50">
                        {t('importSkipped', { count: result.skipped })}
                      </p>
                    )}
                    {error && <p className="text-sm text-destructive">{error}</p>}
                  </>
                ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </div>
            )}
          </div>

          {/* Footer */}
          {(step === 'select' || step === 'done') && (
            <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3 justify-end">
              {step === 'select' && (
                <>
                  <Button variant="ghost" onClick={handleClose}>
                    {tCommon('cancel')}
                  </Button>
                  <Button disabled={selected.size === 0} onClick={doImport}>
                    {t('batchImport')} ({selected.size})
                  </Button>
                </>
              )}
              {step === 'done' && (
                <Button variant="ghost" onClick={handleClose}>
                  {tCommon('close')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
