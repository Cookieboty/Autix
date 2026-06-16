'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  getAmuxHost,
  getSavedCredential,
  saveCredential,
  startOAuthDeviceFlow,
  pollOAuthResult,
  ensurePremiumToken,
  fetchPremiumModels,
  importModelsToLocal,
  type ImportResult,
  type AmuxModel,
} from '@autix/shared-lib';

type Step = 'loading' | 'auth' | 'select' | 'importing' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  amuxHost?: string;
  amuxClientId?: string;
}

export function AmuxImportDialog({
  open,
  onClose,
  onImported,
  amuxHost,
  amuxClientId,
}: Props) {
  const t = useTranslations('models.amuxImport');

  const [step, setStep] = useState<Step>('loading');
  const [statusText, setStatusText] = useState('');
  const [countdown, setCountdown] = useState(300);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const [allModels, setAllModels] = useState<AmuxModel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skToken, setSkToken] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const abortRef = useRef(false);

  const reset = useCallback(() => {
    setStep('loading');
    setStatusText('');
    setCountdown(300);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setError('');
    setAllModels([]);
    setSelected(new Set());
    setSkToken('');
    setActiveFilter('all');
    abortRef.current = false;
  }, []);

  const handleClose = () => {
    abortRef.current = true;
    reset();
    onClose();
  };

  const toggleModel = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredModels = activeFilter === 'all'
    ? allModels
    : allModels.filter((m) => m.modality === activeFilter);

  const allFilteredSelected = filteredModels.length > 0 && filteredModels.every((m) => selected.has(m.name));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredModels.forEach((m) => next.delete(m.name));
      } else {
        filteredModels.forEach((m) => next.add(m.name));
      }
      return next;
    });
  };

  const modalities = Array.from(new Set(allModels.map((m) => m.modality))).sort();

  const loadModelsWithAuth = useCallback(async (auth: { host: string; oat: string; userId: number }) => {
    setStatusText(t('creatingToken'));
    const key = await ensurePremiumToken(auth);
    if (abortRef.current) return;
    setSkToken(key);

    setStatusText(t('fetchingModels'));
    const models = await fetchPremiumModels(auth);
    if (abortRef.current) return;

    if (models.length === 0) {
      setError(t('noModels'));
      setStep('done');
      return;
    }

    setAllModels(models);
    setSelected(new Set(models.map((m) => m.name)));
    setStep('select');
  }, [t]);

  const initFlow = useCallback(async () => {
    abortRef.current = false;
    setError('');
    setStep('loading');

    const host = getAmuxHost(amuxHost);

    try {
      const saved = await getSavedCredential();
      if (saved?.oat) {
        const auth = { host: saved.host || host, oat: saved.oat, userId: saved.amuxUserId };
        await loadModelsWithAuth(auth);
        return;
      }

      setStep('auth');
      setStatusText(t('authWaiting'));
      const { sessionId, authorizeUrl } = await startOAuthDeviceFlow(amuxClientId, host);

      window.open(authorizeUrl, '_blank', 'noopener');

      const startTime = Date.now();
      const countdownTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setCountdown(Math.max(0, 300 - elapsed));
      }, 1000);

      const oauthResult = await pollOAuthResult(sessionId, undefined, host);
      clearInterval(countdownTimer);
      if (abortRef.current) return;

      if (oauthResult.status !== 'authorized' || !oauthResult.accessToken || !oauthResult.userId) {
        setError(t('authDenied'));
        return;
      }

      const auth = { host, oat: oauthResult.accessToken, userId: oauthResult.userId };
      await saveCredential(host, auth.oat, auth.userId);

      setStep('loading');
      await loadModelsWithAuth(auth);
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error');
      if (step === 'loading' || step === 'auth') {
        // keep current step
      } else {
        setStep('done');
      }
    }
  }, [amuxClientId, amuxHost, loadModelsWithAuth, t]);

  useEffect(() => {
    if (open) initFlow();
  }, [open]);

  const doImport = async () => {
    const modelsToImport = allModels.filter((m) => selected.has(m.name));
    if (modelsToImport.length === 0) return;
    setStep('importing');
    try {
      const importResult = await importModelsToLocal(
        modelsToImport,
        skToken,
        (cur, total) => {
          setProgress({ current: cur, total });
          setStatusText(t('importing', { current: cur, total }));
        },
        amuxHost,
      );
      setResult(importResult);
      setStep('done');
      if (importResult.imported.length > 0) onImported();
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error');
      setStep('done');
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div
          className="pointer-events-auto w-full max-w-2xl max-h-[80vh] rounded-2xl border border-default bg-background shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between h-14 px-6 border-b border-default shrink-0">
            <h3 className="text-base font-semibold text-foreground">{t('title')}</h3>
            <Button size="sm" variant="ghost" className="p-0 w-8 h-8" onClick={handleClose} aria-label="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Loading / Auth */}
            {(step === 'loading' || step === 'auth') && (
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
                    <Button variant="default" size="sm" onClick={() => { reset(); initFlow(); }}>
                      {t('retry')}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Model selection */}
            {step === 'select' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/60">
                    {t('selectModels', { total: allModels.length })}
                  </p>
                  <Button size="sm" variant="ghost" onClick={toggleAll}>
                    {allFilteredSelected ? t('deselectAll') : t('selectAll')}
                  </Button>
                </div>

                {/* Filter tabs */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      activeFilter === 'all'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-default text-foreground/50 hover:border-foreground/30'
                    }`}
                  >
                    {t('filterAll')} ({allModels.length})
                  </button>
                  {modalities.map((mod) => (
                    <button
                      key={mod}
                      onClick={() => setActiveFilter(mod)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        activeFilter === mod
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-default text-foreground/50 hover:border-foreground/30'
                      }`}
                    >
                      {mod} ({allModels.filter((m) => m.modality === mod).length})
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredModels.map((m) => (
                    <div
                      key={m.name}
                      onClick={() => toggleModel(m.name)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                        ${selected.has(m.name)
                          ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
                          : 'border-default hover:border-foreground/20 opacity-60'
                        }
                      `}
                    >
                      <Checkbox
                        checked={selected.has(m.name)}
                        onCheckedChange={() => toggleModel(m.name)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-foreground/40">{m.modality}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Importing */}
            {step === 'importing' && (
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
            )}

            {/* Done */}
            {step === 'done' && (
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
            )}
          </div>

          {/* Footer */}
          {(step === 'select' || step === 'done') && (
            <div className="px-6 py-4 border-t border-default shrink-0 flex gap-3 justify-end">
              {step === 'select' && (
                <>
                  <Button variant="ghost" onClick={handleClose}>{t('close')}</Button>
                  <Button variant="default" disabled={selected.size === 0} onClick={doImport}>
                    {t('importSelected', { count: selected.size })}
                  </Button>
                </>
              )}
              {step === 'done' && (
                <>
                  <Button variant="ghost" onClick={handleClose}>{t('close')}</Button>
                  <Button variant="default" onClick={() => setStep('select')}>{t('continueImport')}</Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
