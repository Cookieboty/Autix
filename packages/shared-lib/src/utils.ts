import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (isNaN(timestamp)) return '无效日期';
  const diff = Date.now() - timestamp;
  if (diff < 0) return '刚刚';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
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
