'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getStorage } from '@autix/platform';
import { useModelConfigEnabled } from '../hooks/useModelConfigEnabled';
import { useRouter } from '../navigation';
import { Button } from '../ui/button';

const STORAGE_KEY = 'tip:model-config-dismissed';

interface ModelConfigTipProps {
  hasModels: boolean;
  className?: string;
}

export function ModelConfigTip({ hasModels, className }: ModelConfigTipProps) {
  const t = useTranslations('chat.modelConfigTip');
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);
  const modelConfigEnabled = useModelConfigEnabled(false);

  useEffect(() => {
    let cancelled = false;
    try {
      Promise.resolve(getStorage().getItem(STORAGE_KEY))
        .then((value) => {
          if (!cancelled) setDismissed(value === '1');
        })
        .catch(() => {
          if (!cancelled) setDismissed(false);
        });
    } catch {
      setDismissed(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = modelConfigEnabled && !hasModels && !dismissed;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      void getStorage().setItem(STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures; the dismiss state is still applied in memory.
    }
  };

  const handleGoConfig = () => {
    router.push('/models');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`relative mx-auto w-full max-w-sm rounded-xl border border-primary/20 bg-card p-5 shadow-lg shadow-primary/5 ring-2 ring-primary/10 ${className ?? ''}`}
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-2.5 top-2.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Settings className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t('title')}</p>
              <p className="text-xs text-muted-foreground">{t('description')}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleDismiss}
              >
                {t('later')}
              </Button>
              <Button size="sm" className="text-xs" onClick={handleGoConfig}>
                {t('goConfig')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
