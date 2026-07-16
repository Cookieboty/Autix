'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore, useMembershipPointsRecordsQuery } from '@autix/shared-store';

const DAY_MS = 86_400_000;

function startOfDay(input: Date) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function roundCredits(value: number) {
  return Math.round(value * 100) / 100;
}

type DayBucket = { date: Date; spent: number };

/**
 * 每日额度消耗柱图。数据来自积分流水（type=CONSUME 按天聚合），悬浮显示当日消耗与日期。
 * 用在 Personal profile 的 Usage history 小卡与 /me/settings/usage 页。
 */
export function AccountUsageChart({
  days = 30,
  className = '',
  barHeight = 64,
}: {
  days?: number;
  className?: string;
  barHeight?: number;
}) {
  const t = useTranslations('publicGrowth.accountSettings');
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const recordsQuery = useMembershipPointsRecordsQuery({ pageSize: 200 });
  const [hovered, setHovered] = useState<number | null>(null);

  const buckets = useMemo<DayBucket[]>(() => {
    const startMs = startOfDay(new Date()).getTime() - (days - 1) * DAY_MS;
    const arr: DayBucket[] = Array.from({ length: days }, (_, i) => ({
      date: new Date(startMs + i * DAY_MS),
      spent: 0,
    }));
    for (const record of recordsQuery.data?.items ?? []) {
      if (record.type !== 'CONSUME') continue;
      const dayMs = startOfDay(new Date(record.createdAt)).getTime();
      const idx = Math.round((dayMs - startMs) / DAY_MS);
      if (idx >= 0 && idx < days) arr[idx].spent += Math.abs(record.amount);
    }
    return arr;
  }, [recordsQuery.data, days]);

  const max = Math.max(1, ...buckets.map((b) => b.spent));
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }),
    [locale],
  );
  const axisFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  );

  const active = hovered != null ? buckets[hovered] : null;

  return (
    <div className={className} aria-hidden={!isAuthenticated}>
      <div className="relative" style={{ height: barHeight }}>
        <div className="flex h-full items-end gap-px" onMouseLeave={() => setHovered(null)}>
          {buckets.map((bucket, index) => {
            const isHovered = hovered === index;
            const hasSpend = bucket.spent > 0;
            const heightPct = hasSpend ? Math.max(14, (bucket.spent / max) * 100) : 0;
            return (
              <div
                key={index}
                className="flex h-full flex-1 cursor-default flex-col justify-end items-center"
                onMouseEnter={() => setHovered(index)}
              >
                {hasSpend ? (
                  <span
                    className={`w-1 rounded-full transition-colors ${
                      isHovered ? 'bg-growth-accent' : 'bg-foreground/30'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                ) : (
                  <span
                    className={`size-1 rounded-full ${isHovered ? 'bg-growth-accent' : 'bg-foreground/15'}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {active ? (
          <div
            className="pointer-events-none absolute bottom-0 translate-y-full pt-2"
            style={{ left: `${((hovered! + 0.5) / days) * 100}%`, transform: 'translate(-50%, 100%)' }}
          >
            <span className="whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground/80 shadow-sm">
              {t('profile.usageTooltip', {
                amount: roundCredits(active.spent),
                date: dayFmt.format(active.date),
              })}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex justify-between text-[11px] text-foreground/40">
        <span>{axisFmt.format(buckets[0]?.date ?? new Date())}</span>
        <span>{axisFmt.format(buckets[buckets.length - 1]?.date ?? new Date())}</span>
      </div>
    </div>
  );
}
