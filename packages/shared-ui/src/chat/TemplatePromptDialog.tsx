'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TemplateVariable } from '@autix/shared-lib';
import { useTranslations } from 'next-intl';
import { VariableEditor } from '../template/VariableEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { composeTemplatePrompt } from './utils/composeTemplatePrompt';

const VIDEO_FILE_RE = /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i;
function isVideoUrl(url: string): boolean {
  return VIDEO_FILE_RE.test(url.trim());
}

function RefMediaThumb({ url }: { url: string }) {
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

interface TemplatePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  templatePrompt: string;
  variables: TemplateVariable[];
  referenceImages: string[];
  initialValues: Record<string, string>;
  initialSelectedRefs: string[];
  onApply: (composedPrompt: string, values: Record<string, string>, selectedRefs: string[]) => void;
}

function MobileTabsLayout({
  templatePrompt,
  referenceImages,
  localSelectedRefs,
  variables,
  localValues,
  onToggleRef,
  onSelectAllRefs,
  onClearAllRefs,
  onValuesChange,
  t,
}: {
  templatePrompt: string;
  referenceImages: string[];
  localSelectedRefs: string[];
  variables: TemplateVariable[];
  localValues: Record<string, string>;
  onToggleRef: (url: string) => void;
  onSelectAllRefs: () => void;
  onClearAllRefs: () => void;
  onValuesChange: (v: Record<string, string>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [tab, setTab] = useState<'raw' | 'refs' | 'vars'>('raw');

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 border-b border-border">
        {(['raw', 'refs', 'vars'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-center text-xs font-medium ${tab === key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
              }`}
          >
            {key === 'raw' ? t('template.sectionRaw') : key === 'refs' ? t('template.sectionReferences') : t('template.sectionVariables')}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'raw' && (
          <div className="max-h-full overflow-y-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-5 text-foreground whitespace-pre-wrap">
            {templatePrompt}
          </div>
        )}
        {tab === 'refs' && (
          <>
            {referenceImages.length > 0 ? (
              <>
                <div className="mb-2 flex gap-2 text-xs">
                  <button type="button" onClick={onSelectAllRefs} className="text-primary hover:underline">
                    {t('template.refSelectAll')}
                  </button>
                  <button type="button" onClick={onClearAllRefs} className="text-muted-foreground hover:underline">
                    {t('template.refClear')}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {referenceImages.map((url) => (
                    <div
                      key={url}
                      role="button"
                      tabIndex={0}
                      onClick={() => onToggleRef(url)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleRef(url); } }}
                      className={`relative cursor-pointer aspect-square overflow-hidden rounded-lg border-2 transition-all ${localSelectedRefs.includes(url)
                          ? 'border-primary'
                          : 'border-transparent hover:border-border'
                        }`}
                    >
                      <RefMediaThumb url={url} />
                      <div className="absolute left-1.5 top-1.5">
                        <Checkbox
                          checked={localSelectedRefs.includes(url)}
                          className="pointer-events-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                {t('template.refEmpty')}
              </div>
            )}
          </>
        )}
        {tab === 'vars' && (
          variables.length > 0 ? (
            <VariableEditor
              variables={variables}
              values={localValues}
              onChange={onValuesChange}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
              {t('template.noVariables')}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function TemplatePromptDialog({
  open,
  onOpenChange,
  templateName,
  templatePrompt,
  variables,
  referenceImages,
  initialValues,
  initialSelectedRefs,
  onApply,
}: TemplatePromptDialogProps) {
  const t = useTranslations('chat');
  const tc = useTranslations('common');

  const [localValues, setLocalValues] = useState<Record<string, string>>(initialValues);
  const [localSelectedRefs, setLocalSelectedRefs] = useState<string[]>(initialSelectedRefs);
  const [isMobile, setIsMobile] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setLocalValues(initialValues);
      setLocalSelectedRefs(initialSelectedRefs);
    }
    wasOpenRef.current = open;
  }, [open, initialValues, initialSelectedRefs]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const composed = useMemo(
    () => composeTemplatePrompt(templatePrompt, localValues),
    [templatePrompt, localValues],
  );

  const handleReset = () => {
    const defaults: Record<string, string> = {};
    for (const v of variables) {
      defaults[v.key] = v.default ?? '';
    }
    setLocalValues(defaults);
    setLocalSelectedRefs([]);
  };

  const handleApply = () => {
    onApply(composed, localValues, localSelectedRefs);
  };

  const toggleRef = (url: string) => {
    setLocalSelectedRefs((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url],
    );
  };

  const selectAllRefs = () => setLocalSelectedRefs([...referenceImages]);
  const clearAllRefs = () => setLocalSelectedRefs([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col gap-0 p-0 ${isMobile ? 'h-[90vh] w-[95vw] max-w-none' : 'h-[80vh] max-w-[1100px] sm:max-w-[1100px]'}`}>
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>
            {templateName} · {t('template.editPrompt')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('template.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        {isMobile ? (
          <MobileTabsLayout
            templatePrompt={templatePrompt}
            referenceImages={referenceImages}
            localSelectedRefs={localSelectedRefs}
            variables={variables}
            localValues={localValues}
            onToggleRef={toggleRef}
            onSelectAllRefs={selectAllRefs}
            onClearAllRefs={clearAllRefs}
            onValuesChange={setLocalValues}
            t={t}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Left column */}
            <div className="flex w-1/2 flex-col border-r border-border">
              {/* Template raw text */}
              <div className="shrink-0 border-b border-border p-4">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                  {t('template.sectionRaw')}
                </h3>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-5 text-foreground whitespace-pre-wrap">
                  {templatePrompt}
                </div>
              </div>

              {/* Reference images */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                    {t('template.sectionReferences')}
                  </h3>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t('template.refSelectedCount', {
                      n: localSelectedRefs.length,
                      total: referenceImages.length,
                    })}
                  </span>
                </div>
                {referenceImages.length > 0 ? (
                  <>
                    <div className="mb-2 flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllRefs}
                        className="text-primary hover:underline"
                      >
                        {t('template.refSelectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={clearAllRefs}
                        className="text-muted-foreground hover:underline"
                      >
                        {t('template.refClear')}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {referenceImages.map((url) => (
                        <div
                          key={url}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleRef(url)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRef(url); } }}
                          className={`relative cursor-pointer aspect-square overflow-hidden rounded-lg border-2 transition-all ${localSelectedRefs.includes(url)
                              ? 'border-primary'
                              : 'border-transparent hover:border-border'
                            }`}
                        >
                          <RefMediaThumb url={url} />
                          <div className="absolute left-1.5 top-1.5">
                            <Checkbox
                              checked={localSelectedRefs.includes(url)}
                              className="pointer-events-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                    {t('template.refEmpty')}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: variables */}
            <div className="flex w-1/2 flex-col overflow-y-auto p-4">
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase">
                {t('template.sectionVariables')}
              </h3>
              {variables.length > 0 ? (
                <VariableEditor
                  variables={variables}
                  values={localValues}
                  onChange={setLocalValues}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                  {t('template.noVariables')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            {t('template.reset')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {tc('close')}
          </Button>
          <Button size="sm" onClick={handleApply}>
            {t('template.applyToInput')} ▶
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
