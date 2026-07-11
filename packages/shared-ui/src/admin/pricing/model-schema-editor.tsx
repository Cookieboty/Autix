'use client';

import { lazy, Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DryRunResult, ParamsSchema, PricingSchema } from '@autix/shared-store';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
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

  /**
   * Admin (`clients/web` and `clients/desktop`) ships no light-theme CSS at all: `:root` in
   * both `globals.css` files already holds the dark palette, and neither file defines a
   * `[data-theme='light']` override, so toggling `useTheme()`'s 'light'/'dark' state produces
   * no visual change today. Wiring Monaco to that state (as the previous
   * `document.documentElement.getAttribute('data-theme')` check did) is what caused the
   * white-editor-on-dark-background bug: a fresh admin session defaults to theme state
   * 'light' (see clients/web/components/providers.tsx `defaultTheme="light"`) even though the
   * surrounding chrome always renders dark. Hardcoding vs-dark here matches what the admin
   * actually looks like; revisit once a real light palette ships.
   */
  const theme = 'vs-dark';

  const editorFallback = <Skeleton className="h-full w-full bg-card" />;

  const [activeTab, setActiveTab] = useState<'params' | 'pricing' | 'sample'>('params');

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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="params">{t('paramsSchemaLabel')}</TabsTrigger>
          <TabsTrigger value="pricing">{t('pricingSchemaLabel')}</TabsTrigger>
          <TabsTrigger value="sample">{t('sampleParamsLabel')}</TabsTrigger>
        </TabsList>

        {/* Each editor's text lives in controlled state one level up (paramsSchemaText /
            pricingSchemaText from the parent form) or in sampleParamsText above — so even
            though Radix unmounts the inactive TabsContent panels, switching tabs can never
            drop unsaved edits; the next mount just re-renders from the same state. */}
        <TabsContent value="params">
          <div className="bg-card h-64 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
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
        </TabsContent>
        <TabsContent value="pricing">
          <div className="bg-card h-64 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
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
        </TabsContent>
        <TabsContent value="sample">
          <div className="bg-card h-64 overflow-hidden rounded-md border" style={{ borderColor: 'var(--border)' }}>
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
        </TabsContent>
      </Tabs>

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
