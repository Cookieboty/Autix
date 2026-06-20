'use client';

import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import type { AmuxModel, ImportResult } from '@autix/shared-store';
import type { AmuxImportStep } from './amux-import-presenters';

interface AmuxImportDialogViewProps {
  step: AmuxImportStep;
  statusText: string;
  countdown: number;
  progress: { current: number; total: number };
  result: ImportResult | null;
  error: string;
  allModels: AmuxModel[];
  filteredModels: AmuxModel[];
  selected: ReadonlySet<string>;
  activeFilter: string;
  modalities: string[];
  allFilteredSelected: boolean;
  onClose: () => void;
  onRetry: () => void;
  onToggleAll: () => void;
  onFilterChange: (filter: string) => void;
  onToggleModel: (name: string) => void;
  onImport: () => void;
  onContinueImport: () => void;
}

export function AmuxImportDialogView({
  step,
  statusText,
  countdown,
  progress,
  result,
  error,
  allModels,
  filteredModels,
  selected,
  activeFilter,
  modalities,
  allFilteredSelected,
  onClose,
  onRetry,
  onToggleAll,
  onFilterChange,
  onToggleModel,
  onImport,
  onContinueImport,
}: AmuxImportDialogViewProps) {
  const t = useTranslations('models.amuxImport');

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div
          className="pointer-events-auto w-full max-w-2xl max-h-[80vh] rounded-2xl border border-default bg-background shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between h-14 px-6 border-b border-default shrink-0">
            <h3 className="text-base font-semibold text-foreground">{t('title')}</h3>
            <Button size="sm" variant="ghost" className="p-0 w-8 h-8" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {(step === 'loading' || step === 'auth') && (
              <AmuxImportWaitingState
                step={step}
                statusText={statusText}
                countdown={countdown}
                error={error}
                onRetry={onRetry}
              />
            )}

            {step === 'select' && (
              <AmuxImportSelectionState
                allModels={allModels}
                filteredModels={filteredModels}
                selected={selected}
                activeFilter={activeFilter}
                modalities={modalities}
                allFilteredSelected={allFilteredSelected}
                onToggleAll={onToggleAll}
                onFilterChange={onFilterChange}
                onToggleModel={onToggleModel}
              />
            )}

            {step === 'importing' && (
              <AmuxImportProgressState
                statusText={statusText}
                progress={progress}
              />
            )}

            {step === 'done' && (
              <AmuxImportDoneState result={result} error={error} />
            )}
          </div>

          <AmuxImportFooter
            step={step}
            selectedCount={selected.size}
            onClose={onClose}
            onImport={onImport}
            onContinueImport={onContinueImport}
          />
        </div>
      </div>
    </>
  );
}

function AmuxImportWaitingState({
  step,
  statusText,
  countdown,
  error,
  onRetry,
}: {
  step: AmuxImportStep;
  statusText: string;
  countdown: number;
  error: string;
  onRetry: () => void;
}) {
  const t = useTranslations('models.amuxImport');

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      {!error ? (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-foreground/20" />
          <p className="text-sm text-foreground/60">{statusText}</p>
          {step === 'auth' && (
            <p className="text-xs text-foreground/40">
              {t('authCountdown', { seconds: countdown })}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-danger">{error}</p>
          <Button variant="default" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </>
      )}
    </div>
  );
}

function AmuxImportSelectionState({
  allModels,
  filteredModels,
  selected,
  activeFilter,
  modalities,
  allFilteredSelected,
  onToggleAll,
  onFilterChange,
  onToggleModel,
}: {
  allModels: AmuxModel[];
  filteredModels: AmuxModel[];
  selected: ReadonlySet<string>;
  activeFilter: string;
  modalities: string[];
  allFilteredSelected: boolean;
  onToggleAll: () => void;
  onFilterChange: (filter: string) => void;
  onToggleModel: (name: string) => void;
}) {
  const t = useTranslations('models.amuxImport');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/60">
          {t('selectModels', { total: allModels.length })}
        </p>
        <Button size="sm" variant="ghost" onClick={onToggleAll}>
          {allFilteredSelected ? t('deselectAll') : t('selectAll')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            activeFilter === 'all'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-default text-foreground/50 hover:border-foreground/30'
          }`}
        >
          {t('filterAll')} ({allModels.length})
        </button>
        {modalities.map((modality) => (
          <button
            key={modality}
            onClick={() => onFilterChange(modality)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeFilter === modality
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-default text-foreground/50 hover:border-foreground/30'
            }`}
          >
            {modality} ({allModels.filter((model) => model.modality === modality).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filteredModels.map((model) => (
          <div
            key={model.name}
            onClick={() => onToggleModel(model.name)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
              ${selected.has(model.name)
                ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
                : 'border-default hover:border-foreground/20 opacity-60'
              }
            `}
          >
            <Checkbox
              checked={selected.has(model.name)}
              onCheckedChange={() => onToggleModel(model.name)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{model.name}</p>
              <p className="text-xs text-foreground/40">{model.modality}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AmuxImportProgressState({
  statusText,
  progress,
}: {
  statusText: string;
  progress: { current: number; total: number };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-foreground/20" />
      <p className="text-sm text-foreground/60">{statusText}</p>
      {progress.total > 0 && (
        <div className="w-64 bg-default-100 rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AmuxImportDoneState({
  result,
  error,
}: {
  result: ImportResult | null;
  error: string;
}) {
  const t = useTranslations('models.amuxImport');

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      {result ? (
        <>
          <p className="text-base font-semibold text-foreground">{t('doneTitle')}</p>
          {result.imported.length > 0 && (
            <p className="text-sm text-success">{t('importedCount', { count: result.imported.length })}</p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-sm text-foreground/50">{t('skippedCount', { count: result.skipped.length })}</p>
          )}
          {result.failed.length > 0 && (
            <p className="text-sm text-danger">{t('failedCount', { count: result.failed.length })}</p>
          )}
        </>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : null}
    </div>
  );
}

function AmuxImportFooter({
  step,
  selectedCount,
  onClose,
  onImport,
  onContinueImport,
}: {
  step: AmuxImportStep;
  selectedCount: number;
  onClose: () => void;
  onImport: () => void;
  onContinueImport: () => void;
}) {
  const t = useTranslations('models.amuxImport');

  if (step !== 'select' && step !== 'done') return null;

  return (
    <div className="px-6 py-4 border-t border-default shrink-0 flex gap-3 justify-end">
      {step === 'select' && (
        <>
          <Button variant="ghost" onClick={onClose}>{t('close')}</Button>
          <Button variant="default" disabled={selectedCount === 0} onClick={onImport}>
            {t('importSelected', { count: selectedCount })}
          </Button>
        </>
      )}
      {step === 'done' && (
        <>
          <Button variant="ghost" onClick={onClose}>{t('close')}</Button>
          <Button variant="default" onClick={onContinueImport}>{t('continueImport')}</Button>
        </>
      )}
    </div>
  );
}
