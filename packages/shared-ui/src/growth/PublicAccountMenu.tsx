'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Crown, LogOut, Settings, User } from 'lucide-react';
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
import { cn } from '../ui/utils';
import {
  GROWTH_DIALOG_CONTENT,
  GROWTH_DIALOG_DESCRIPTION,
  GROWTH_DIALOG_HEADER,
  GROWTH_DIALOG_TITLE,
} from './dialog-styles';

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

/**
 * 头像外环的积分进度。`ratio` 是 0..1 的**剩余**占比：主色弧画的是还剩多少，
 * 不是已经花了多少（后者与电量表之类的日常直觉相反）。
 */
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
  const hydrated = useAuthStore((state) => state.hydrated);
  const logout = useAuthStore((state) => state.logout);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const membershipQuery = useMyMembershipQuery(isAuthenticated);
  const pointsQuery = usePointsBalanceQuery(isAuthenticated);
  const pointsSummaryQuery = usePointsSummaryQuery(isAuthenticated);
  // 悬浮延时关闭用的定时器 ref —— 必须在任何条件 return 之前声明，保证 hooks 顺序稳定
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 头像外环进度 = **剩余**积分 / 已发放积分总额。
   *
   * 原来画的是已消耗占比，方向反了：主色弧越长表示花得越多，等于「用得越狠环越满」。
   * 用户对这种环的直觉是「剩下多少」（同电量/油量表），满环 = 充足、快空 = 该充值了。
   * 没有发放记录时按满环处理，而不是空环 —— 空环会让新用户以为自己没积分。
   */
  const remainingRatio = (() => {
    const grants = pointsSummaryQuery.data?.grants ?? [];
    let total = 0;
    let consumed = 0;
    for (const grant of grants) {
      total += grant.totalAmount ?? 0;
      consumed += grant.consumedAmount ?? 0;
    }
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, (total - consumed) / total));
  })();

  // hydrate 完成前无法确定登录态：渲染与头像等尺寸的中性占位，
  // 避免已登录用户在公开页 SSR/首帧闪现「登录/注册」按钮甚至误触打开登录弹窗。
  if (!hydrated) {
    const ringSize = compact ? 32 : 40;
    return (
      <div
        className="shrink-0 animate-pulse rounded-full bg-secondary"
        style={{ width: ringSize, height: ringSize }}
        aria-hidden
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
        {/* 登录走弹窗（不打断当前浏览），注册直接进独立页面 */}
        {/* 样式与导航里的 Pricing / Assets 入口一致（growth-nav-btn + pillSize） */}
        <button
          type="button"
          onClick={() => openAuthModal({ mode: 'entry' })}
          className={cn(
            'growth-nav-btn inline-flex cursor-pointer items-center gap-2 font-semibold text-growth-accent transition-all duration-300',
            compact ? 'min-h-7 px-2.5 text-[13px]' : 'min-h-9 px-3 text-sm',
          )}
        >
          {t('signIn')}
        </button>
        <Link
          href="/register"
          className={cn(
            'inline-flex cursor-pointer items-center justify-center rounded-lg bg-growth-accent font-bold text-background transition hover:brightness-110',
            compact ? 'min-h-7 px-3 text-[13px]' : 'min-h-9 px-4 text-sm',
          )}
        >
          {t('signUp')}
        </Link>
      </div>
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
    // View Profile → 公开个人内容页 `/@username`（客态可见的那张页面），
    // 账号设置仍走下面的 Manage Account（/me/settings）。
    { label: t('viewProfile'), href: `/@${user.username}`, icon: User },
    { label: t('manageAccount'), href: '/me/settings', icon: Settings },
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
          <PointsUsageRing ratio={remainingRatio} size={compact ? 32 : 40}>
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
            <PointsUsageRing ratio={remainingRatio} size={38}>
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
        <DialogContent className={cn(GROWTH_DIALOG_CONTENT, 'max-h-[86vh] sm:max-w-[980px]')}>
          <DialogHeader className={GROWTH_DIALOG_HEADER}>
            <DialogTitle className={GROWTH_DIALOG_TITLE}>
              <Crown className="size-4 text-growth-accent" />
              {tMembership('upgradeMembership')}
            </DialogTitle>
            <DialogDescription className={GROWTH_DIALOG_DESCRIPTION}>
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
