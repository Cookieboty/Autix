'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip';
import { formatCurrency } from './chat-dashboard.helpers';

export function CurrencyAmount({
  amount,
  currency,
  locale,
  unknownCurrencyTooltip,
}: {
  amount: string;
  currency: string;
  locale: string;
  unknownCurrencyTooltip: string;
}) {
  const formatted = formatCurrency(amount, currency, locale);

  if (currency !== 'UNKNOWN') {
    return <span>{formatted}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="decoration-muted-foreground cursor-help underline decoration-dotted underline-offset-4"
        >
          {formatted}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{unknownCurrencyTooltip}</TooltipContent>
    </Tooltip>
  );
}
