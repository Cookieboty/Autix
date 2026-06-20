'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ensurePremiumToken,
  fetchPremiumModels,
  getAmuxHost,
  getSavedCredential,
  importModelsToLocal,
  pollOAuthResult,
  saveCredential,
  startOAuthDeviceFlow,
  type AmuxModel,
  type ImportResult,
} from '@autix/shared-store';
import { AmuxImportDialogView } from './AmuxImportDialogView';
import {
  areAllFilteredModelsSelected,
  filterAmuxModels,
  getAmuxModalities,
  toggleFilteredModelSelection,
  toggleModelSelection,
  type AmuxImportStep,
} from './amux-import-presenters';

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

  const [step, setStep] = useState<AmuxImportStep>('loading');
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

  const filteredModels = filterAmuxModels(allModels, activeFilter);
  const allFilteredSelected = areAllFilteredModelsSelected(filteredModels, selected);
  const modalities = getAmuxModalities(allModels);

  const toggleModel = (name: string) => {
    setSelected((prev) => toggleModelSelection(prev, name));
  };

  const toggleAll = () => {
    setSelected((prev) => toggleFilteredModelSelection(prev, filteredModels, allFilteredSelected));
  };

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
    setSelected(new Set(models.map((model) => model.name)));
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
  }, [amuxClientId, amuxHost, loadModelsWithAuth, step, t]);

  useEffect(() => {
    if (open) initFlow();
  }, [open]);

  const doImport = async () => {
    const modelsToImport = allModels.filter((model) => selected.has(model.name));
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

  const retry = () => {
    reset();
    initFlow();
  };

  if (!open) return null;

  return (
    <AmuxImportDialogView
      step={step}
      statusText={statusText}
      countdown={countdown}
      progress={progress}
      result={result}
      error={error}
      allModels={allModels}
      filteredModels={filteredModels}
      selected={selected}
      activeFilter={activeFilter}
      modalities={modalities}
      allFilteredSelected={allFilteredSelected}
      onClose={handleClose}
      onRetry={retry}
      onToggleAll={toggleAll}
      onFilterChange={setActiveFilter}
      onToggleModel={toggleModel}
      onImport={doImport}
      onContinueImport={() => setStep('select')}
    />
  );
}
