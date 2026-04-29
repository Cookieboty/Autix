'use client';

import { useState } from 'react';
import {
  Button,
  ModalBackdrop,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useTemplateStore } from '@/store/template.store';

export function AmuxConfigDialog() {
  const t = useTranslations('amuxConfig');
  const tCommon = useTranslations('common');
  const { showAmuxDialog, setShowAmuxDialog, amuxConfig, setAmuxConfig } = useTemplateStore();
  const [baseUrl, setBaseUrl] = useState(amuxConfig?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(amuxConfig?.apiKey ?? '');

  if (!showAmuxDialog) return null;

  const handleSave = () => {
    if (!baseUrl.trim() || !apiKey.trim()) return;
    setAmuxConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
  };

  return (
    <ModalBackdrop isOpen onOpenChange={(open) => { if (!open) setShowAmuxDialog(false); }}>
      <ModalDialog>
        <ModalHeader>
          <ModalHeading>{t('title')}</ModalHeading>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('description')}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('apiUrl')}</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full h-10 px-3 text-sm rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full h-10 px-3 text-sm rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onPress={() => setShowAmuxDialog(false)}>{tCommon('cancel')}</Button>
          <Button variant="primary" onPress={handleSave}>{tCommon('save')}</Button>
        </ModalFooter>
      </ModalDialog>
    </ModalBackdrop>
  );
}
