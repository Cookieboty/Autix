'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { publicProfileActions, useAuthStore, type PublicProfile } from '@autix/shared-store';
import { PublicGrowthShell } from '../PublicGrowthShell';
import { ProfileBanner, ProfileSidebar } from './ProfileHeaderCard';
import { ProfileGenerationsFeed } from './ProfileGenerationsFeed';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; profile: PublicProfile };

/**
 * `/@username` 公开个人页装配层。
 *
 * - 拉 `GET /profiles/:username` 得到公开信息；用户不存在/已注销 → notFound 态。
 * - 主态/客态：与登录用户 username 比对。主态额外开放 banner/头像换图与「编辑资料」。
 * - 主态实时性：banner/avatar/昵称/简介编辑走 auth store，编辑后就地覆盖 profile 快照，
 *   无需重新拉整个 profile（统计等其它字段保持首拉值即可）。
 */
export function ProfilePublicView({ username }: { username: string }) {
  const t = useTranslations('publicGrowth.publicProfile');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    publicProfileActions
      .getByUsername(username)
      .then((profile) => {
        if (!cancelled) setState({ status: 'ready', profile });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (state.status === 'error') {
    return (
      <PublicGrowthShell showPromo={false} showFooter={false} navVariant="contained">
        <div className="grid min-h-[calc(100svh-3rem)] place-items-center px-6 text-center">
          <div>
            <h1 className="text-2xl font-black text-foreground">{t('notFoundTitle')}</h1>
            <p className="mt-2 text-sm text-foreground/55">{t('notFoundSubtitle')}</p>
          </div>
        </div>
      </PublicGrowthShell>
    );
  }

  const profile = state.status === 'ready' ? state.profile : null;
  const isOwner = Boolean(profile && authUser?.username === profile.username);

  // 主态就地覆盖 avatar/banner/昵称/简介为 store 里的最新值（编辑/换图后立刻反映，
  // 不必重拉整个 profile）。客态或未登录时按服务端快照展示。
  const effectiveProfile: PublicProfile | null =
    profile && isOwner && authUser
      ? {
          ...profile,
          avatar: authUser.avatar ?? profile.avatar,
          bannerImage: authUser.bannerImage ?? profile.bannerImage,
          displayName:
            authUser.nickname?.trim() || authUser.realName?.trim() || profile.displayName,
          headline: authUser.headline ?? profile.headline,
          bio: authUser.description ?? profile.bio,
        }
      : profile;

  return (
    <PublicGrowthShell showPromo={false} showFooter={false} navVariant="contained">
      {/* banner 背景全宽（唯一例外）；下方内容与导航核心内容同宽（max-w-[1920px] + px-3/md:px-5） */}
      <ProfileBanner
        bannerImage={effectiveProfile?.bannerImage ?? null}
        isOwner={isOwner}
      />

      <div className="mx-auto max-w-[1920px] px-3 pb-16 md:px-5">
        <div className="grid gap-8 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr]">
          {effectiveProfile ? (
            <ProfileSidebar profile={effectiveProfile} isOwner={isOwner} />
          ) : (
            <ProfileSidebarSkeleton />
          )}

          <main className="min-w-0 pt-6 md:pt-8">
            <div className="mb-6 flex items-center gap-6 border-b border-border">
              <span className="relative -mb-px border-b-2 border-foreground pb-3 text-sm font-bold text-foreground">
                {t('generations')}
              </span>
            </div>
            {effectiveProfile ? (
              <ProfileGenerationsFeed username={effectiveProfile.username} />
            ) : null}
          </main>
        </div>
      </div>
    </PublicGrowthShell>
  );
}

function ProfileSidebarSkeleton() {
  return (
    <aside className="relative z-10 -mt-14 md:-mt-16">
      <div className="size-28 rounded-full bg-secondary ring-4 ring-background md:size-32" />
      <div className="mt-4 h-8 w-40 rounded bg-secondary" />
      <div className="mt-2 h-4 w-24 rounded bg-secondary" />
      <div className="mt-6 space-y-2.5">
        <div className="h-4 w-full max-w-xs rounded bg-secondary" />
        <div className="h-4 w-full max-w-xs rounded bg-secondary" />
      </div>
    </aside>
  );
}
