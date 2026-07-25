/**
 * 相对时间。全程按传入 locale 本地化（词与日期同源），不再混用固定语言：
 * `Intl.RelativeTimeFormat` 负责 "N 分钟前" 类文案，>7 天回退到该 locale 的日期格式。
 * 调用方传各自的请求语言（默认 'en'）。
 */
export function relativeTime(iso: string, locale = 'en'): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const sec = Math.round((Date.now() - timestamp) / 1000); // >0 表示过去
  if (Math.abs(sec) < 60) return rtf.format(-sec, 'second');
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute');
  const hours = Math.round(min / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString(locale);
}

export function normalizeCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase();
  return normalized || 'USD';
}

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
