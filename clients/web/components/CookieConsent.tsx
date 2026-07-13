'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const STORAGE_KEY = 'cookie-consent';
type ConsentValue = 'accepted' | 'rejected';

function readConsent(): ConsentValue | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'accepted' || v === 'rejected' ? v : null;
  } catch {
    // localStorage 不可用（隐私模式/被禁用）：静默视作「无需处理」，不打扰用户。
    return null;
  }
}

function writeConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 写入失败无妨：本次会话内 banner 仍会关闭，选择仅未持久化。
  }
}

export function CookieConsent() {
  const t = useTranslations('cookieConsent');
  // 初始 false：避免 SSR 预渲染出 banner 后客户端读到已存在的 consent 造成闪烁。
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setVisible(true);
  }, []);

  function decide(value: ConsentValue) {
    writeConsent(value);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t('ariaLabel')}
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:gap-6 sm:p-5">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm leading-6 text-muted-foreground">
                {t('message')}{' '}
                <Link href="#" className="font-medium text-link underline-offset-2 hover:underline">
                  {t('learnMore')}
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => decide('rejected')}
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t('reject')}
              </button>
              <button
                type="button"
                onClick={() => decide('accepted')}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                {t('accept')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
