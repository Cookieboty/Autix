'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AVATAR_UPLOAD_LIMITS, OWN_PROFILE_LIMITS, type UpdateOwnProfileInput } from '@autix/domain';
import { authActions, useAuthStore } from '@autix/shared-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { toast } from '../../ui';

const BIO_MAX = OWN_PROFILE_LIMITS.descriptionMaxLength;

const FIELD_CLASS =
  'w-full rounded-lg bg-[rgb(24,25,28)] px-3.5 py-2.5 text-sm text-foreground outline-none ring-1 ring-inset ring-white/5 transition placeholder:text-foreground/35 focus:ring-growth-accent/60 disabled:cursor-not-allowed disabled:opacity-50';

const SOCIAL_FIELDS = [
  { key: 'socialX', placeholder: 'x.com/' },
  { key: 'socialInstagram', placeholder: 'instagram.com/' },
  { key: 'socialYoutube', placeholder: 'youtube.com/@' },
  { key: 'socialTiktok', placeholder: 'tiktok.com/@' },
] as const;

type FormKey =
  | 'name'
  | 'headline'
  | 'bio'
  | 'location'
  | 'socialX'
  | 'socialInstagram'
  | 'socialYoutube'
  | 'socialTiktok';

type FormState = Record<FormKey, string>;

function toForm(user: ReturnType<typeof useAuthStore.getState>['user']): FormState {
  return {
    // Username 字段回填 nickname，缺省用 username 兜底（不改动即不落库）
    name: user?.nickname ?? user?.username ?? '',
    headline: user?.headline ?? '',
    bio: user?.description ?? '',
    location: user?.location ?? '',
    socialX: user?.socialX ?? '',
    socialInstagram: user?.socialInstagram ?? '',
    socialYoutube: user?.socialYoutube ?? '',
    socialTiktok: user?.socialTiktok ?? '',
  };
}

export function EditProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('publicGrowth.accountSettings');
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const nicknameEditable = (user as { nicknameEditable?: boolean } | null)?.nicknameEditable !== false;
  const descriptionEditable = (user as { descriptionEditable?: boolean } | null)?.descriptionEditable !== false;

  const [form, setForm] = useState<FormState>(() => toForm(user));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 每次打开时用最新 store 值重置表单
  useEffect(() => {
    if (open) {
      setForm(toForm(user));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: FormKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    setError(null);
    if (!(AVATAR_UPLOAD_LIMITS.allowedContentTypes as readonly string[]).includes(file.type)) {
      setError(t('editProfile.errorAvatarType'));
      return;
    }
    if (file.size > AVATAR_UPLOAD_LIMITS.maxSizeBytes) {
      setError(t('editProfile.errorAvatarSize', { maxMb: Math.round(AVATAR_UPLOAD_LIMITS.maxSizeBytes / 1024 / 1024) }));
      return;
    }
    setUploading(true);
    try {
      await authActions.uploadAvatar(file);
    } catch {
      setError(t('editProfile.errorGeneric'));
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    const original = toForm(user);
    const payload: UpdateOwnProfileInput = {};
    const put = (field: keyof UpdateOwnProfileInput, key: FormKey, editable = true) => {
      if (editable && form[key] !== original[key]) {
        const v = form[key].trim();
        (payload as Record<string, string | null>)[field] = v === '' ? null : v;
      }
    };
    put('nickname', 'name', nicknameEditable);
    put('description', 'bio', descriptionEditable);
    put('headline', 'headline');
    put('location', 'location');
    put('socialX', 'socialX');
    put('socialInstagram', 'socialInstagram');
    put('socialYoutube', 'socialYoutube');
    put('socialTiktok', 'socialTiktok');

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await authActions.updateOwnProfile(payload);
      toast.success(t('editProfile.saved'));
      onOpenChange(false);
    } catch {
      setError(t('editProfile.errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const name0 = (user?.nickname || user?.username || user?.email || 'A').trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden border-0 bg-[rgb(20,21,24)] p-0 sm:max-w-[460px]">
        <DialogHeader className="shrink-0 border-b border-white/5 px-5 py-4">
          <DialogTitle className="text-base font-bold text-foreground">{t('editProfile.title')}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* 头像 + 上传 */}
          <div className="flex items-center gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-black text-growth-accent growth-avatar-glow">
              {user?.avatar ? (
                <img src={user.avatar} alt={name0} className="h-full w-full object-cover" />
              ) : (
                <span className="grid size-[72%] place-items-center rounded-full bg-growth-accent text-background">
                  {(name0[0] || 'A').toUpperCase()}
                </span>
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_UPLOAD_LIMITS.allowedContentTypes.join(',')}
              onChange={onUpload}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(24,25,28)] px-3.5 py-2 text-sm font-semibold text-foreground ring-1 ring-inset ring-white/5 transition hover:bg-[rgb(30,32,35)] disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {t('editProfile.upload')}
            </button>
          </div>

          {/* Username → nickname */}
          <Field label={t('editProfile.username')}>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={OWN_PROFILE_LIMITS.nicknameMaxLength}
              disabled={!nicknameEditable}
              placeholder={user?.username ?? ''}
              className={FIELD_CLASS}
            />
          </Field>

          {/* Headline */}
          <Field label={t('editProfile.headline')}>
            <input
              value={form.headline}
              onChange={(e) => set('headline', e.target.value)}
              maxLength={OWN_PROFILE_LIMITS.headlineMaxLength}
              placeholder={t('editProfile.headlinePlaceholder')}
              className={FIELD_CLASS}
            />
          </Field>

          {/* Bio → description */}
          <Field label={t('editProfile.bio')}>
            <div className="relative">
              <textarea
                value={form.bio}
                onChange={(e) => set('bio', e.target.value.slice(0, BIO_MAX))}
                disabled={!descriptionEditable}
                rows={4}
                placeholder={t('editProfile.bioPlaceholder')}
                className={`${FIELD_CLASS} resize-none pb-6`}
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-foreground/35">
                {form.bio.length} / {BIO_MAX}
              </span>
            </div>
          </Field>

          {/* Location */}
          <Field label={t('editProfile.location')}>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={OWN_PROFILE_LIMITS.locationMaxLength}
              placeholder={t('editProfile.locationPlaceholder')}
              className={FIELD_CLASS}
            />
          </Field>

          {/* Socials */}
          <Field label={t('editProfile.socials')}>
            <div className="space-y-2">
              {SOCIAL_FIELDS.map((s) => (
                <input
                  key={s.key}
                  value={form[s.key]}
                  onChange={(e) => set(s.key, e.target.value)}
                  maxLength={OWN_PROFILE_LIMITS.socialMaxLength}
                  placeholder={s.placeholder}
                  className={FIELD_CLASS}
                />
              ))}
            </div>
          </Field>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg bg-[rgb(24,25,28)] px-5 py-2 text-sm font-semibold text-foreground ring-1 ring-inset ring-white/5 transition hover:bg-[rgb(30,32,35)]"
          >
            {t('editProfile.cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2 text-sm font-bold text-background transition hover:bg-foreground/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('editProfile.save')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-semibold text-foreground/85">{label}</span>
      {children}
    </div>
  );
}
