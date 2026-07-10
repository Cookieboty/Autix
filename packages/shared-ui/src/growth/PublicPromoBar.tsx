'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getStorage } from '@autix/platform';
import { buildDiscountTranslationValues } from './discount';

function storageKey(label: string, href: string) {
  return `amux.publicPromo.dismissed.${href}.${label}`.slice(0, 180);
}

export function PublicPromoBar({
  label,
  href = '/pricing',
  className = '',
}: {
  label?: string;
  href?: string;
  className?: string;
}) {
  const t = useTranslations('publicGrowth.promoBar');
  const key = useMemo(() => (label ? storageKey(label, href) : ''), [href, label]);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.resolve(getStorage().getItem(key))
      .then((value) => {
        if (!cancelled) setDismissed(value === '1');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!label || dismissed || !ready) return null;

  return (
    <div
      className={`growth-promo-bar-shadow relative border-b border-primary-foreground/10 bg-growth-accent px-10 py-2 text-center text-xs font-bold text-primary-foreground ${className}`}
    >
      <a href={href} className="inline-flex max-w-full items-center justify-center gap-2">
        <span className="truncate">{label}</span>
        <span className="growth-promo-badge rounded-md px-2 py-0.5 text-[10px] font-black uppercase italic text-foreground">
          {t('discountBadge', buildDiscountTranslationValues())}
        </span>
      </a>
      <button
        type="button"
        aria-label={t('close')}
        className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        onClick={() => {
          void getStorage().setItem(key, '1');
          setDismissed(true);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
