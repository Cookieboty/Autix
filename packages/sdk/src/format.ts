export function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (isNaN(timestamp)) return 'Invalid date';
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export function normalizeCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase();
  return normalized || 'USD';
}

/** @deprecated Keep presentation formatting in the UI layer. */
export function formatCurrency(
  value: string | number | null | undefined,
  currency?: string | null,
): string {
  const amount = Number(value);
  const normalizedCurrency = normalizeCurrency(currency);
  if (!Number.isFinite(amount)) return `${normalizedCurrency} -`;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
}
