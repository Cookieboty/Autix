'use client';

import { useState } from 'react';
import { Ticket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AccountPanelPlaceholder } from './AccountPanelPlaceholder';

export function AccountPromoPanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  // TODO(scaffold): 接真实兑换接口（listRedemptions / redeemCode）。
  const [code, setCode] = useState('');

  return (
    <AccountPanelPlaceholder icon={Ticket} title={t('promo.title')} subtitle={t('promo.subtitle')}>
      <div className="rounded-2xl bg-[rgb(24,25,28)] p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('promo.placeholder')}
            className="min-w-0 flex-1 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-growth-accent"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="shrink-0 rounded-lg bg-foreground px-5 py-2.5 text-sm font-bold text-background transition enabled:hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-foreground/40"
          >
            {t('promo.redeem')}
          </button>
        </form>
      </div>
    </AccountPanelPlaceholder>
  );
}
