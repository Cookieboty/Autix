'use client';

import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DryRunResult, ParamsSchema, PricingSchema } from '@autix/shared-store';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { buildDryRunPayload, parseJsonOrNull } from './pricing-admin-helpers';

// Lazy + Suspense, matching packages/shared-ui/src/artifact/ArtifactEditor.tsx — Monaco has no
// SSR story, so the import is deferred to the client instead of loaded eagerly at module scope.
const Editor = lazy(() => import('@monaco-editor/react'));

export interface ModelSchemaEditorProps {
  /** Raw Monaco JSON text for the params schema. Fully controlled — the caller owns the text and
   * is responsible for seeding/gating it against async load (see SystemModelFormSheet). */
  paramsSchemaText: string;
  /** Raw Monaco JSON text for the pricing schema. Same controlled contract as paramsSchemaText. */
  pricingSchemaText: string;
  onParamsSchemaTextChange: (text: string) => void;
  onPricingSchemaTextChange: (text: string) => void;
  /**
   * Injected rather than called internally — mirrors task-costs-view.tsx's `handleSaveRule`
   * split (container orchestrates network + list refresh; the form component only collects
   * data and reports it upward). The container wires this to
   * `pricingAdminActions.dryRunPricing(buildDryRunPayload(...))`.
   *
   * On an invalid schema the backend rejects the dry-run request with a 400
   * (`BadRequestException({ message, violations })`) rather than resolving with an
   * error-shaped body, so `onDryRun` is expected to reject — this component surfaces that via
   * a caught error message.
   *
   * Persisting the schemas themselves is NOT this component's job — save is unified into
   * whichever form embeds this editor (the model config form), so there is deliberately no
   * `onSave`/save button here.
   */
  onDryRun: (payload: ReturnType<typeof buildDryRunPayload>) => Promise<DryRunResult>;
}

export function ModelSchemaEditor({
  paramsSchemaText,
  pricingSchemaText,
  onParamsSchemaTextChange,
  onPricingSchemaTextChange,
  onDryRun,
}: ModelSchemaEditorProps) {
  const t = useTranslations('adminPricing.schemaEditor');
  const [sampleParamsText, setSampleParamsText] = useState('{}');
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [dryRunning, setDryRunning] = useState(false);

  const theme = useMemo(() => {
    if (typeof document === 'undefined') return 'vs';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';
  }, []);

  const editorFallback = <Skeleton className="h-full w-full" />;

  const handleDryRun = async () => {
    const paramsSchema = parseJsonOrNull(paramsSchemaText) as ParamsSchema | null;
    const pricingSchema = parseJsonOrNull(pricingSchemaText) as PricingSchema | null;
    const sampleParams = parseJsonOrNull(sampleParamsText) as Record<string, unknown> | null;
    if (!paramsSchema || !pricingSchema || !sampleParams) {
      setDryRunError(t('invalidJson'));
      return;
    }
    setDryRunning(true);
    setDryRunError(null);
    try {
      const result = await onDryRun(buildDryRunPayload(paramsSchema, pricingSchema, sampleParams));
      setDryRunResult(result);
    } catch (error) {
      setDryRunResult(null);
      setDryRunError(error instanceof Error ? error.message : t('dryRunFailed'));
    } finally {
      setDryRunning(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('paramsSchemaLabel')}</span>
          <div className="h-64 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
            <Suspense fallback={editorFallback}>
              <Editor
                height="100%"
                language="json"
                theme={theme}
                value={paramsSchemaText}
                onChange={(value) => onParamsSchemaTextChange(value ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
              />
            </Suspense>
          </div>
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('pricingSchemaLabel')}</span>
          <div className="h-64 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
            <Suspense fallback={editorFallback}>
              <Editor
                height="100%"
                language="json"
                theme={theme}
                value={pricingSchemaText}
                onChange={(value) => onPricingSchemaTextChange(value ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
              />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('sampleParamsLabel')}</span>
        <div className="h-24 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
          <Suspense fallback={editorFallback}>
            <Editor
              height="100%"
              language="json"
              theme={theme}
              value={sampleParamsText}
              onChange={(value) => setSampleParamsText(value ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
            />
          </Suspense>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={dryRunning}
          onClick={() => void handleDryRun()}
        >
          {dryRunning ? t('dryRunning') : t('dryRun')}
        </Button>
      </div>

      {dryRunError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{dryRunError}</p>}

      {dryRunResult && (
        <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t('dryRunTotal', { total: dryRunResult.total })}
          </p>
          {dryRunResult.breakdown.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {dryRunResult.breakdown.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                  <span className="min-w-0 flex-1 truncate">{entry.id}</span>
                  <span>{entry.op}</span>
                  <span>{entry.contribution}</span>
                  <span>→ {entry.accumulatorAfter}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
