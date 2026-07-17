'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Loader2, Pencil, Trash2 } from 'lucide-react';
import { AVATAR_UPLOAD_LIMITS, BANNER_UPLOAD_LIMITS, type PublicProfile } from '@autix/domain';
import { authActions } from '@autix/shared-store';
import { EditProfileDialog } from '../account/EditProfileDialog';
import { toast } from '../../ui';

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

async function pickAndUpload(
  evt: React.ChangeEvent<HTMLInputElement>,
  limits: typeof AVATAR_UPLOAD_LIMITS | typeof BANNER_UPLOAD_LIMITS,
  setBusy: (v: boolean) => void,
  upload: (file: File) => Promise<unknown>,
  onError: () => void,
) {
  const file = evt.target.files?.[0];
  evt.target.value = '';
  if (!file) return;
  if (
    !(limits.allowedContentTypes as readonly string[]).includes(file.type) ||
    file.size > limits.maxSizeBytes
  ) {
    onError();
    return;
  }
  setBusy(true);
  try {
    await upload(file);
  } catch {
    onError();
  } finally {
    setBusy(false);
  }
}

/**
 * 顶部 banner —— 有图铺图，无图走深色渐变。主态（isOwner）悬浮出换图/移除。
 * 全宽渲染，位于两栏布局之上；头像由 ProfileSidebar 用 -mt 上提交叠到此处。
 */
export function ProfileBanner({
  bannerImage,
  isOwner,
}: {
  bannerImage: string | null;
  isOwner: boolean;
}) {
  const t = useTranslations('publicGrowth.publicProfile');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const removeBanner = async () => {
    setBusy(true);
    try {
      await authActions.removeBanner();
    } catch {
      toast.error(t('coverError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="group/banner relative h-[220px] w-full overflow-hidden bg-secondary md:h-[300px]">
      {bannerImage ? (
        <img src={bannerImage} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="growth-profile-hero-overlay absolute inset-0 bg-gradient-to-b from-secondary to-background" />
      )}
      {isOwner ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={BANNER_UPLOAD_LIMITS.allowedContentTypes.join(',')}
            onChange={(e) =>
              pickAndUpload(e, BANNER_UPLOAD_LIMITS, setBusy, authActions.uploadBanner, () =>
                toast.error(t('coverError')),
              )
            }
            className="sr-only"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition group-hover/banner:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:bg-white/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {bannerImage ? t('changeCover') : t('addCover')}
            </button>
            {bannerImage ? (
              <button
                type="button"
                onClick={removeBanner}
                disabled={busy}
                aria-label={t('removeCover')}
                className="inline-flex size-9 items-center justify-center rounded-lg bg-black/60 text-white shadow-lg transition hover:bg-black/75 disabled:opacity-60"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * 左栏：悬浮头像 + 昵称/角色/简介/统计 + 编辑入口。主态悬浮头像出相机可换图，
 * 「编辑资料」打开与 /me/settings 同一个 EditProfileDialog。客态只读。
 * 头像/昵称的实时值由父组件在主态下用 auth store 覆盖后传入 profile。
 */
export function ProfileSidebar({
  profile,
  isOwner,
}: {
  profile: PublicProfile;
  isOwner: boolean;
}) {
  const t = useTranslations('publicGrowth.publicProfile');
  const [editOpen, setEditOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const initial = (profile.displayName[0] || profile.username[0] || 'A').toUpperCase();

  return (
    <aside className="relative z-10 -mt-14 md:-mt-16">
      <div className="group/avatar relative size-28 overflow-hidden rounded-full ring-4 ring-background md:size-32">
        {profile.avatar ? (
          <img src={profile.avatar} alt={profile.displayName} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-growth-accent text-4xl font-black text-background">
            {initial}
          </span>
        )}
        {isOwner ? (
          <>
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATAR_UPLOAD_LIMITS.allowedContentTypes.join(',')}
              onChange={(e) =>
                pickAndUpload(e, AVATAR_UPLOAD_LIMITS, setAvatarBusy, authActions.uploadAvatar, () =>
                  toast.error(t('coverError')),
                )
              }
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              aria-label={t('changeAvatar')}
              className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover/avatar:opacity-100"
            >
              {avatarBusy ? (
                <Loader2 className="size-5 animate-spin text-white" />
              ) : (
                <Camera className="size-5 text-white" />
              )}
            </button>
          </>
        ) : null}
      </div>

      <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">{profile.displayName}</h1>
      <p className="mt-1 text-sm text-foreground/55">{profile.headline?.trim() || t('creator')}</p>
      {profile.bio ? (
        <p className="mt-3 max-w-xs text-sm leading-6 text-foreground/70">{profile.bio}</p>
      ) : null}

      {/* 统计：本仓库暂无关注系统，只展示真实的 Views / Likes。 */}
      <dl className="mt-6 max-w-xs space-y-2.5">
        {[
          { label: t('views'), value: profile.stats.viewCount },
          { label: t('likes'), value: profile.stats.likeCount },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-sm text-foreground/55">{row.label}</dt>
            <dd className="text-sm font-bold text-foreground">{formatMetric(row.value)}</dd>
          </div>
        ))}
      </dl>

      {isOwner ? (
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="mt-6 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
        >
          <Pencil className="size-4" />
          {t('editProfile')}
        </button>
      ) : null}

      {isOwner ? <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} /> : null}
    </aside>
  );
}
