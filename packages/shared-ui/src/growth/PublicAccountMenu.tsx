'use client';

import { useState } from 'react';
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
  const dotCount = 24;
  const activeDots = Math.max(0, Math.min(dotCount, Math.ceil(value / 10)));

  return (
    <div className="mt-3 flex gap-1" aria-hidden="true">
      {Array.from({ length: dotCount }).map((_, index) => (
        <span
          key={index}
          className={`size-2 rounded-full ${
            index < activeDots ? 'bg-[#c9ff00]' : 'bg-white/10'
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
}: {
  name: string;
  avatar?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'size-12' : size === 'sm' ? 'size-9' : 'size-10';
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#c9ff00] bg-white/10 text-sm font-black text-[#d6ff2b] shadow-[0_0_24px_rgb(201_255_0/0.44)] ${sizeClass}`}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="grid size-[72%] place-items-center rounded-full bg-[#d6ff2b] text-black">
          {avatarInitial(name)}
        </span>
      )}
    </span>
  );
}

export function PublicAccountMenu() {
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

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal({ mode: 'entry' })}
        className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-[#c9ff00]/45 bg-[#c9ff00]/12 px-4 text-sm font-black text-[#c9ff00] shadow-[0_0_22px_rgb(201_255_0/0.24)] transition hover:border-[#c9ff00] hover:bg-[#c9ff00] hover:text-black"
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

  const quickLinks = [
    { label: t('viewProfile'), href: '/profile', icon: User },
    { label: t('manageAccount'), href: '/profile', icon: Settings },
    { label: t('pointsHistory'), href: '/membership/points', icon: Coins },
    { label: t('assets'), href: '/materials', icon: PackageOpen },
  ];

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full bg-transparent outline-none ring-offset-black transition hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[#c9ff00]"
          aria-label={t('accountMenu')}
        >
          <AvatarMark name={name} avatar={user.avatar} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={14}
        className="w-[330px] overflow-hidden rounded-md border border-white/10 bg-[#17191b] p-0 text-white shadow-[0_24px_80px_rgb(0_0_0/0.55)] ring-0"
      >
        <div className="p-4">
          <div className="flex items-center gap-3">
            <AvatarMark name={name} avatar={user.avatar} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-white">{name}</div>
              <div className="mt-1 truncate text-sm text-white/50">{planName}</div>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-white/[0.06] p-4">
            <Link
              href="/membership/points"
              className="flex items-center justify-between gap-3 text-white"
            >
              <span className="text-sm font-semibold">{t('credits')}</span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-white/55">
                {t('creditsLeft', { count: points })}
                <ChevronRight className="size-4" />
              </span>
            </Link>
            <CreditDots value={points} />
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                type="button"
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-white/[0.06] px-3 text-left text-white transition hover:bg-[#c9ff00] hover:text-black"
                onClick={openUpgradeDialog}
              >
                <span className="inline-flex min-w-0 items-center gap-3 text-sm font-semibold">
                  <Crown className="size-5 shrink-0 text-[#c9ff00]" />
                  <span>{activeMembership ? t('managePlan') : t('goPremium')}</span>
                </span>
                <span className="rounded-full bg-[#c9ff00] px-4 py-1.5 text-sm font-black text-black">
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
                className="cursor-pointer rounded-md px-3 py-3 text-white/88 focus:bg-white/8 focus:text-white"
              >
                <Link href={item.href} className="flex items-center gap-3">
                  <Icon className="size-5 text-white/48" />
                  <span className="text-sm font-semibold">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-3 text-white/88 focus:bg-white/8 focus:text-white"
          >
            <Link href="/membership/benefits" className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-white/48" />
              <span className="text-sm font-semibold">{t('membershipCenter')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-3 my-2 bg-white/10" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer rounded-md px-3 py-3 text-white/88 focus:bg-white/8 focus:text-white"
          >
            <LogOut className="size-5 text-white/48" />
            <span className="text-sm font-semibold">{t('signOut')}</span>
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
