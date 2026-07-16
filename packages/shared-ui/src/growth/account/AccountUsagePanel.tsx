'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Coins,
  Info,
  Layers,
  Receipt,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMembershipPointsRecordsQuery } from '@autix/shared-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Skeleton } from '../../ui/skeleton';

const DAY = 86_400_000;
// 分类固定顺序 → 稳定配色（无模型名，按积分流水 source 分类拆分）
const SOURCES = [
  'MEMBERSHIP',
  'PACKAGE',
  'TASK',
  'INVITATION',
  'ADMIN_GRANT',
  'AGENT_CALL',
  'CAMPAIGN',
  'EXPIRATION',
] as const;
const SOURCE_COLORS = ['#a3e635', '#ec4899', '#38bdf8', '#f59e0b', '#a78bfa', '#f87171', '#34d399', '#94a3b8'];

function colorFor(source: string) {
  const i = SOURCES.indexOf(source as (typeof SOURCES)[number]);
  return SOURCE_COLORS[(i >= 0 ? i : 0) % SOURCE_COLORS.length];
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const TRIGGER_CLASS =
  'h-8 gap-1.5 rounded-lg border-0 bg-white/5 px-2.5 text-xs font-medium text-foreground/70 shadow-none transition hover:bg-white/10 hover:text-foreground data-placeholder:text-foreground/70 focus-visible:ring-1 focus-visible:ring-growth-accent';

// 浮层比页面亮一档才不「惨淡」；选中勾用主题色（对齐设计）
const CONTENT_CLASS =
  'min-w-[10rem] border-0 bg-[rgb(32,33,37)] p-1.5 ring-1 ring-white/10 shadow-xl [&_.lucide-check]:text-growth-accent';
const ITEM_CLASS = 'rounded-lg py-2 text-foreground/80 focus:bg-white/10 focus:text-foreground';

// Image #14 的范围选项；days=null 表示全部，'today' 从当日 0 点起算
const RANGES = [
  { key: 'today', days: 0 },
  { key: 'd7', days: 7 },
  { key: 'month', days: 30 },
  { key: 'm3', days: 90 },
  { key: 'm6', days: 180 },
  { key: 'year', days: 365 },
  { key: 'all', days: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function rangeCutoff(key: RangeKey) {
  if (key === 'all') return -Infinity;
  if (key === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return Date.now() - (RANGES.find((r) => r.key === key)?.days ?? 0) * DAY;
}

export function AccountUsagePanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  const locale = useLocale();
  const query = useMembershipPointsRecordsQuery({ pageSize: 200 });
  const all = useMemo(() => query.data?.items ?? [], [query.data]);

  const [range, setRange] = useState<RangeKey>('d7');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'spent' | 'earned'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [bannerOpen, setBannerOpen] = useState(true);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    [locale],
  );
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const inRange = useMemo(() => {
    if (range === 'all') return all;
    const cutoff = rangeCutoff(range);
    return all.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
  }, [all, range]);

  const filtered = useMemo(
    () =>
      inRange.filter(
        (r) =>
          (sourceFilter === 'all' || r.source === sourceFilter) &&
          (actionFilter === 'all' ||
            (actionFilter === 'spent' ? r.type === 'CONSUME' : r.type === 'EARN')),
      ),
    [inRange, sourceFilter, actionFilter],
  );

  const spent = round2(
    inRange.filter((r) => r.type === 'CONSUME').reduce((s, r) => s + Math.abs(r.amount), 0),
  );
  const earned = round2(
    inRange.filter((r) => r.type === 'EARN').reduce((s, r) => s + Math.abs(r.amount), 0),
  );
  const usedSources = useMemo(() => [...new Set(inRange.map((r) => r.source))], [inRange]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of inRange) {
      if (r.type !== 'CONSUME') continue;
      map.set(r.source, (map.get(r.source) ?? 0) + Math.abs(r.amount));
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return [...map.entries()]
      .map(([source, amt]) => ({ source, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
      .sort((a, b) => b.amt - a.amt);
  }, [inRange]);

  const availableSources = useMemo(() => SOURCES.filter((s) => all.some((r) => r.source === s)), [all]);
  const earliest = useMemo(
    () => (all.length ? all.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), all[0].createdAt) : null),
    [all],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const rows = filtered.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  const resetPage = () => setPage(1);

  if (query.isLoading) return <UsageSkeleton />;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">{t('usage.pageTitle')}</h1>
          <p className="mt-1 text-sm text-foreground/55">{t('usage.pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-foreground/80 transition hover:bg-white/10 hover:text-foreground"
          >
            <RefreshCw className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            {t('usage.refresh')}
          </button>
          <Select
            value={range}
            onValueChange={(v) => {
              setRange(v as RangeKey);
              resetPage();
            }}
          >
            <SelectTrigger size="sm" className={TRIGGER_CLASS} aria-label={t('usage.rangeLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className={CONTENT_CLASS}>
              {RANGES.map((r) => (
                <SelectItem key={r.key} value={r.key} className={ITEM_CLASS}>
                  {t(`usage.range.${r.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 数据可用范围提示 */}
      {bannerOpen && earliest ? (
        <div className="flex items-start gap-3 rounded-2xl bg-[rgb(24,25,28)] p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-foreground/45" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {t('usage.bannerTitle', { date: dateFmt.format(new Date(earliest)) })}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-foreground/50">{t('usage.bannerBody')}</p>
          </div>
          <button
            type="button"
            onClick={() => setBannerOpen(false)}
            className="grid size-6 shrink-0 place-items-center rounded-md text-foreground/45 transition hover:bg-white/5 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* 消耗概览 */}
      <div className="space-y-5 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground/70">
          <BarChart3 className="size-4" />
          {t('usage.spendOverview')}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Coins} value={spent} label={t('usage.creditsSpent')} />
          <Stat icon={Sparkles} value={earned} label={t('usage.creditsEarned')} />
          <Stat icon={Layers} value={usedSources.length} label={t('usage.categories')} />
          <Stat icon={Receipt} value={inRange.length} label={t('usage.transactions')} />
        </div>

        {breakdown.length > 0 ? (
          <div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
              {breakdown.map((b) => (
                <div key={b.source} style={{ width: `${b.pct}%`, background: colorFor(b.source) }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {breakdown.map((b) => (
                <span key={b.source} className="inline-flex items-center gap-1.5 text-xs text-foreground/75">
                  <span className="size-2 rounded-full" style={{ background: colorFor(b.source) }} />
                  {t(`usage.source.${b.source}`)}
                  <span className="text-foreground/40">{Math.round(b.pct)}%</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 使用记录表 */}
      <div className="rounded-2xl bg-[rgb(24,25,28)] p-5">
        <p className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground/70">
          <BarChart3 className="size-4" />
          {t('usage.historyTitle')}
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-semibold text-foreground/60">
            {filtered.length}
          </span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left align-middle">
                <th className="pb-3 pr-3 text-xs font-medium text-foreground/45">{t('usage.colCredits')}</th>
                <th className="pb-3 pr-3">
                  <Select
                    value={sourceFilter}
                    onValueChange={(v) => {
                      setSourceFilter(v);
                      resetPage();
                    }}
                  >
                    <SelectTrigger size="sm" className={TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" className={CONTENT_CLASS}>
                      <SelectItem value="all" className={ITEM_CLASS}>
                        {t('usage.filterAllCategories')}
                      </SelectItem>
                      {availableSources.map((s) => (
                        <SelectItem key={s} value={s} className={ITEM_CLASS}>
                          {t(`usage.source.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </th>
                <th className="pb-3 pr-3">
                  <Select
                    value={actionFilter}
                    onValueChange={(v) => {
                      setActionFilter(v as typeof actionFilter);
                      resetPage();
                    }}
                  >
                    <SelectTrigger size="sm" className={TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" className={CONTENT_CLASS}>
                      <SelectItem value="all" className={ITEM_CLASS}>
                        {t('usage.filterAllActions')}
                      </SelectItem>
                      <SelectItem value="spent" className={ITEM_CLASS}>
                        {t('usage.actionSpent')}
                      </SelectItem>
                      <SelectItem value="earned" className={ITEM_CLASS}>
                        {t('usage.actionEarned')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </th>
                <th className="pb-3 text-xs font-medium text-foreground/45">{t('usage.colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pr-3 font-semibold text-foreground underline decoration-foreground/25 decoration-dotted underline-offset-4">
                    {t('usage.creditsUnit', { amount: round2(Math.abs(r.amount)) })}
                  </td>
                  <td className="py-3 pr-3 text-foreground/85" title={r.remark ?? undefined}>
                    {t(`usage.source.${r.source}`)}
                  </td>
                  <td className="py-3 pr-3 text-foreground/70">
                    {r.type === 'CONSUME' ? t('usage.actionSpent') : t('usage.actionEarned')}
                  </td>
                  <td className="py-3 font-semibold text-foreground">
                    {dateFmt.format(new Date(r.createdAt))}{' '}
                    <span className="font-normal text-foreground/45">{timeFmt.format(new Date(r.createdAt))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/40">{t('usage.empty')}</p>
          ) : null}
        </div>

        {/* 分页 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/55">
          <div className="flex items-center gap-2">
            {t('usage.show')}
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                resetPage();
              }}
            >
              <SelectTrigger size="sm" className={TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className={CONTENT_CLASS}>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} className={ITEM_CLASS}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span>{t('usage.pageOf', { page: pageClamped, total: totalPages })}</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pageClamped <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid size-7 place-items-center rounded-md bg-white/5 text-foreground/70 transition enabled:hover:bg-white/10 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={pageClamped >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid size-7 place-items-center rounded-md bg-white/5 text-foreground/70 transition enabled:hover:bg-white/10 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-foreground/50">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-foreground/50">{label}</p>
      </div>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <div className="space-y-5 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      <div className="space-y-3 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
