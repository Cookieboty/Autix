'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getStorage } from '@autix/platform';

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
      className={`relative border-b border-black/10 bg-[#c9ff00] px-10 py-2 text-center text-xs font-bold text-black shadow-[0_10px_34px_rgb(201_255_0/0.18)] ${className}`}
    >
      <a href={href} className="inline-flex max-w-full items-center justify-center gap-2">
        <span className="truncate">{label}</span>
        <span className="rounded-md bg-[#ff1675] px-2 py-0.5 text-[10px] font-black uppercase italic text-white">
          Special 30% off
        </span>
      </a>
      <button
        type="button"
        aria-label="Close promotion"
        className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-black/70 hover:bg-black/10 hover:text-black"
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
