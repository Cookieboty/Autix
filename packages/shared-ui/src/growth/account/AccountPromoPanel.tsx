'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '../../ui';

export function AccountPromoPanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  const [code, setCode] = useState('');

  const onClaim = () => {
    // 后台暂无通用兑换码接口 → 先不对接，占位提示。
    // TODO: 后端提供 promo/redeem 端点后接入 authActions/membership redeem。
    toast.message(t('promo.comingSoon'));
  };

  const trimmed = code.trim();

  return (
    <div className="flex min-h-[calc(100svh-14rem)] flex-col">
      <h1 className="text-lg font-bold text-foreground">{t('promo.heading')}</h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('promo.placeholder')}
          spellCheck={false}
          autoComplete="off"
          aria-label={t('promo.heading')}
          className="w-full bg-transparent text-center text-4xl font-black tracking-tight text-foreground caret-growth-accent outline-none placeholder:font-black placeholder:text-foreground/25 sm:text-6xl"
        />

        {trimmed ? (
          <button
            type="button"
            onClick={onClaim}
            className="rounded-2xl bg-growth-accent/10 px-8 py-3 text-base font-bold text-growth-accent transition hover:bg-growth-accent/20"
          >
            {t('promo.claim')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
