'use client';

import { useRef, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Coins,
  Crown,
  LogOut,
  PackageOpen,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAuthStore,
  useMyMembershipQuery,
  usePointsBalanceQuery,
  usePointsSummaryQuery,
  useUiStore,
} from '@autix/shared-store';
import { Link, useRouter } from '../navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { MembershipUpgradeView } from '../membership/MembershipUpgradeView';

function displayName(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.realName || user?.username || user?.email || 'Amux';
}

function avatarInitial(name: string) {
  return (name.trim()[0] || 'A').toUpperCase();
}

function isActiveMembership(
  membership: NonNullable<ReturnType<typeof useMyMembershipQuery>['data']>['membership'] | null | undefined,
) {
  return Boolean(
    membership &&
      membership.status === 'ACTIVE' &&
      new Date(membership.expiresAt).getTime() > Date.now(),
  );
}

function CreditDots({ value }: { value: number }) {
  const dotCount = 20;
  const activeDots = Math.max(0, Math.min(dotCount, Math.ceil(value / 10)));

  return (
    <div className="mt-2 flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: dotCount }).map((_, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${
            index < activeDots ? 'bg-growth-accent' : 'bg-foreground/15'
          }`}
        />
      ))}
    </div>
  );
}

function AvatarMark({
  name,
  avatar,
  size = 'md',
  px,
}: {
  name: string;
  avatar?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Explicit pixel size; overrides the `size` preset when provided. */
  px?: number;
}) {
  const sizeClass = px
    ? ''
    : size === 'lg' ? 'size-12' : size === 'sm' ? 'size-9' : size === 'xs' ? 'size-7' : 'size-10';
  // 环内头像(传入 px)不需要边框
  const borderClass = px ? '' : 'border-2 border-growth-accent';
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-black text-growth-accent growth-avatar-glow transition-all duration-300 ${borderClass} ${sizeClass}`}
      style={px ? { width: px, height: px } : undefined}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="grid size-[72%] place-items-center rounded-full bg-growth-accent text-background">
          {avatarInitial(name)}
        </span>
      )}
    </span>
  );
}

/** Circular points-usage progress ring wrapping the avatar. `ratio` is 0..1 consumed. */
function PointsUsageRing({
  ratio,
  size,
  children,
}: {
  ratio: number;
  size: number;
  children: ReactNode;
}) {
  // 固定内部坐标系：几何量与像素 size 无关，滚动缩放时进度弧不重绘（不再闪烁）
  const VB = 40;
  const stroke = 3;
  const r = (VB - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <span
      className="relative grid place-items-center transition-all duration-300"
      style={{ width: size, height: size }}
    >
      <svg
        className="pointer-events-none absolute inset-0 -rotate-90"
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB} ${VB}`}
        aria-hidden="true"
      >
        <circle
          cx={VB / 2}
          cy={VB / 2}
          r={r}
          fill="none"
          stroke="rgb(255 255 255 / 0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={VB / 2}
          cy={VB / 2}
          r={r}
          fill="none"
          stroke="var(--growth-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {children}
    </span>
  );
}

export function PublicAccountMenu({ compact = false }: { compact?: boolean } = {}) {
  const t = useTranslations('publicGrowth.accountMenu');
  const tMembership = useTranslations('membership');
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const membershipQuery = useMyMembershipQuery(isAuthenticated);
  const pointsQuery = usePointsBalanceQuery(isAuthenticated);
  const pointsSummaryQuery = usePointsSummaryQuery(isAuthenticated);
  // 悬浮关闭延时器：hook 必须在任何条件 return 之前声明，否则未登录/已登录切换时 hook 数量不一致
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 头像外环进度 = 已消耗积分 / 已发放积分总额
  const usageRatio = (() => {
    const grants = pointsSummaryQuery.data?.grants ?? [];
    let total = 0;
    let consumed = 0;
    for (const grant of grants) {
      total += grant.totalAmount ?? 0;
      consumed += grant.consumedAmount ?? 0;
    }
    return total > 0 ? Math.min(1, consumed / total) : 0;
  })();

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal({ mode: 'entry' })}
        className={`inline-flex cursor-pointer items-center justify-center rounded-full border border-growth-accent/45 bg-growth-accent/12 font-black text-growth-accent growth-signin-glow transition hover:border-growth-accent hover:bg-growth-accent hover:text-background ${
          compact ? 'min-h-7 px-3 text-[13px]' : 'min-h-10 px-4 text-sm'
        }`}
        aria-label={t('signInOrRegister')}
      >
        {t('signInOrRegister')}
      </button>
    );
  }

  const name = displayName(user);
  const membership = membershipQuery.data?.membership ?? null;
  const activeMembership = isActiveMembership(membership);
  const planName = activeMembership ? membership?.level?.name : t('freePlan');
  const points =
    pointsQuery.data?.balance ??
    pointsQuery.data?.availableBalance ??
    membershipQuery.data?.pointsBalance ??
    0;

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const openUpgradeDialog = () => {
    setMenuOpen(false);
    setUpgradeOpen(true);
  };

  // 悬浮打开：进入触发器/面板即打开，离开后延时关闭以便跨过两者间隙
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openOnHover = () => {
    cancelClose();
    setMenuOpen(true);
  };
  const closeOnHover = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setMenuOpen(false), 160);
  };

  const quickLinks = [
    { label: t('viewProfile'), href: '/profile', icon: User },
    { label: t('manageAccount'), href: '/profile', icon: Settings },
    { label: t('pointsHistory'), href: '/membership/points', icon: Coins },
    { label: t('assets'), href: '/materials', icon: PackageOpen },
  ];

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid place-items-center rounded-full bg-transparent outline-none ring-offset-background transition duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-growth-accent"
          aria-label={t('accountMenu')}
          onMouseEnter={openOnHover}
          onMouseLeave={closeOnHover}
        >
          <PointsUsageRing ratio={usageRatio} size={compact ? 32 : 40}>
            <AvatarMark name={name} avatar={user.avatar} px={compact ? 24 : 30} />
          </PointsUsageRing>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        onMouseEnter={cancelClose}
        onMouseLeave={closeOnHover}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-[260px] overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground growth-dropdown-shadow ring-0"
      >
        <div className="p-3">
          <div className="flex items-center gap-2.5">
            <PointsUsageRing ratio={usageRatio} size={38}>
              <AvatarMark name={name} avatar={user.avatar} px={28} />
            </PointsUsageRing>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              <div className="truncate text-xs text-foreground/50">{planName}</div>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-secondary p-3">
            <Link
              href="/membership/points"
              className="flex items-center justify-between gap-3 text-foreground"
            >
              <span className="text-xs font-semibold">{t('credits')}</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-foreground/55">
                {t('creditsLeft', { count: points })}
                <ChevronRight className="size-3.5" />
              </span>
            </Link>
            <CreditDots value={points} />
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                className="group flex min-h-8 w-full cursor-pointer items-center justify-between gap-3 text-left text-foreground transition"
                onClick={openUpgradeDialog}
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                  <Crown className="size-4 shrink-0 text-growth-accent" />
                  <span>{activeMembership ? t('managePlan') : t('goPremium')}</span>
                </span>
                <span className="rounded-full bg-growth-accent px-3 py-1 text-xs font-black text-background transition group-hover:bg-growth-accent-hover">
                  {t('upgrade')}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-2 pb-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.href + item.label}
                asChild
                className="cursor-pointer rounded-xl px-3 py-1.5 text-foreground/88 focus:bg-secondary focus:text-foreground"
              >
                <Link href={item.href} className="flex items-center gap-3">
                  <Icon className="size-4 text-foreground/48" />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-xl px-3 py-1.5 text-foreground/88 focus:bg-secondary focus:text-foreground"
          >
            <Link href="/membership/benefits" className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-foreground/48" />
              <span className="text-[13px] font-medium">{t('membershipCenter')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-3 my-1.5 bg-border" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer rounded-xl px-3 py-1.5 text-foreground/88 focus:bg-secondary focus:text-foreground"
          >
            <LogOut className="size-4 text-foreground/48" />
            <span className="text-[13px] font-medium">{t('signOut')}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-[980px]">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              {tMembership('upgradeMembership')}
            </DialogTitle>
            <DialogDescription>
              {tMembership('choosePlan')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <MembershipUpgradeView
              descriptionKey="choosePlan"
              descriptionVariant="plain"
              showDowngradeToast={false}
              onNavigateOrder={(orderId) => {
                setUpgradeOpen(false);
                router.push(`/membership/orders/${orderId}`);
              }}
              onCheckoutFallback={() => {
                setUpgradeOpen(false);
                router.push('/membership/orders');
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
