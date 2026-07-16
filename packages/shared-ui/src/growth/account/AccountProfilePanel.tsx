'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FolderOpen,
  Image as ImageIcon,
  Languages,
  Pencil,
  Settings2,
  Tag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  authActions,
  useAuthStore,
  useLanguageStore,
  useMyMembershipQuery,
  usePointsBalanceQuery,
  usePointsSummaryQuery,
} from '@autix/shared-store';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@autix/i18n';
import { Link } from '../../navigation';
import { Switch } from '../../ui/switch';
import { Skeleton } from '../../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { AccountUsageChart } from './AccountUsageChart';
import { EditProfileDialog } from './EditProfileDialog';

function displayName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.nickname || user?.realName || user?.username || user?.email || '';
}

function ProfileAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-black text-growth-accent growth-avatar-glow">
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="grid size-[72%] place-items-center rounded-full bg-growth-accent text-background">
          {(name.trim()[0] || 'A').toUpperCase()}
        </span>
      )}
    </span>
  );
}

const DELETION_ITEMS = [
  { key: 'generations', icon: ImageIcon },
  { key: 'library', icon: FolderOpen },
  { key: 'subscription', icon: Tag },
  { key: 'settings', icon: Settings2 },
  { key: 'credits', icon: Wallet },
] as const;

export function AccountProfilePanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pointsQuery = usePointsBalanceQuery(isAuthenticated);
  const pointsSummaryQuery = usePointsSummaryQuery(isAuthenticated);
  const membershipQuery = useMyMembershipQuery(isAuthenticated);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const [editOpen, setEditOpen] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(true);
  const [deletionConfirmed, setDeletionConfirmed] = useState<Record<string, boolean>>({});
  // TODO(scaffold): 删除账户走 step-up 复用 ProfileView 的自助流程后再启用真实删除。

  const autoPublish = Boolean(user?.autoPublish);
  const [savingAutoPublish, setSavingAutoPublish] = useState(false);
  const handleAutoPublishChange = async (next: boolean) => {
    setSavingAutoPublish(true);
    try {
      await authActions.updateAutoPublish(next);
    } catch {
      // 失败时 store.user.autoPublish 未变，Switch 的 checked 自动回退到旧值。
    } finally {
      setSavingAutoPublish(false);
    }
  };

  const name = displayName(user);
  const points =
    pointsQuery.data?.balance ??
    pointsQuery.data?.availableBalance ??
    membershipQuery.data?.pointsBalance ??
    0;

  const totalGranted = (pointsSummaryQuery.data?.grants ?? []).reduce(
    (sum, grant) => sum + (grant.totalAmount ?? 0),
    0,
  );
  const poolPercent = totalGranted > 0 ? Math.round((points / totalGranted) * 100) : 0;

  const allConfirmed = DELETION_ITEMS.every((item) => deletionConfirmed[item.key]);

  // 用户或额度数据未就绪时先出骨架屏（避免闪现空名/占位文案）
  const loading = !user || pointsQuery.isLoading || pointsSummaryQuery.isLoading;
  if (loading) return <ProfileSkeleton />;

  return (
    <div className="space-y-6">
      {/* 头部：头像 + 名称 + 邮箱 */}
      <div className="flex items-center gap-4">
        <ProfileAvatar name={name} avatar={user?.avatar} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-black text-foreground">{name}</h1>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground/80 transition hover:text-foreground"
            >
              <Pencil className="size-3.5" />
              {t('profile.edit')}
            </button>
          </div>
          <p className="mt-0.5 truncate text-sm text-foreground/50">{user?.email}</p>
        </div>
      </div>

      {/* Credits + Usage history 两卡 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[rgb(24,25,28)] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground/70">
            <Wallet className="size-4" />
            {t('profile.credits')}
          </p>
          <div className="mt-8 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-black text-foreground">
                {t('profile.creditsLeft', { count: points })}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                {t('profile.creditsPool', { percent: poolPercent })}
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background transition hover:bg-foreground/90"
            >
              {t('profile.topUp')}
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-[rgb(24,25,28)] p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground/70">
              <TrendingUp className="size-4" />
              {t('profile.usageHistory')}
            </p>
            <Link href="/me/settings/usage" className="text-xs font-semibold text-foreground/60 transition hover:text-foreground">
              {t('profile.seeAll')}
            </Link>
          </div>
          <AccountUsageChart className="mt-6" />
        </div>
      </div>

      {/* 语言切换 */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Languages className="size-4 text-foreground/60" />
            {t('profile.languageTitle')}
          </p>
          <p className="mt-1 text-xs leading-5 text-foreground/55">{t('profile.languageBody')}</p>
        </div>
        <Select value={language} onValueChange={(v) => void setLanguage(v as SupportedLanguage)}>
          <SelectTrigger
            size="sm"
            className="h-9 min-w-[9rem] gap-1.5 rounded-lg border-0 bg-white/5 px-3 text-sm font-medium text-foreground shadow-none transition hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-growth-accent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            className="min-w-[9rem] border-0 bg-[rgb(32,33,37)] p-1.5 ring-1 ring-white/10 [&_.lucide-check]:text-growth-accent"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem
                key={lang}
                value={lang}
                className="rounded-lg py-2 text-foreground/80 focus:bg-white/10 focus:text-foreground"
              >
                {LANGUAGE_LABELS[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 自动发布开关：作为 /ai/image 隐私按钮的默认可见性来源 */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-[rgb(24,25,28)] p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {t('profile.autoPublishTitle')}
          </p>
          <p className="mt-1 text-xs leading-5 text-foreground/55">{t('profile.autoPublishBody')}</p>
        </div>
        <Switch
          checked={autoPublish}
          disabled={savingAutoPublish}
          onCheckedChange={(v) => void handleAutoPublishChange(v)}
        />
      </div>

      {/* 账户删除折叠区 */}
      <div className="rounded-2xl bg-[rgb(24,25,28)]">
        <button
          type="button"
          onClick={() => setDeletionOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">{t('profile.deletionTitle')}</p>
            <p className="mt-1 text-xs text-foreground/55">{t('profile.deletionSubtitle')}</p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-foreground/50 transition ${deletionOpen ? 'rotate-180' : ''}`} />
        </button>

        {deletionOpen ? (
          <div className="px-5 pb-5">
            <div className="rounded-xl bg-[rgb(28,30,32)] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="size-4 fill-red-500 text-red-500" />
                {t('profile.deletionWarning')}
              </p>

              <div className="mt-3 space-y-2">
                {DELETION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const checked = Boolean(deletionConfirmed[item.key]);
                  return (
                    <label
                      key={item.key}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3.5 py-3 transition ${
                        checked
                          ? 'bg-red-500/10 ring-1 ring-inset ring-red-500/25'
                          : 'bg-[rgb(20,21,24)]'
                      }`}
                    >
                      <span
                        className={`flex items-center gap-2.5 text-sm transition ${
                          checked ? 'text-foreground' : 'text-foreground/80'
                        }`}
                      >
                        <Icon className={`size-4 ${checked ? 'text-red-500' : 'text-foreground/45'}`} />
                        {t(`profile.deletionItems.${item.key}`)}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setDeletionConfirmed((prev) => ({ ...prev, [item.key]: e.target.checked }))
                        }
                        className="peer sr-only"
                      />
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                          checked ? 'border-red-500 bg-red-500' : 'border-foreground/30'
                        }`}
                        aria-hidden="true"
                      >
                        {checked ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!allConfirmed}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition enabled:bg-red-500/90 enabled:text-white enabled:hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-foreground/35"
              >
                {t('profile.deleteAccount')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
