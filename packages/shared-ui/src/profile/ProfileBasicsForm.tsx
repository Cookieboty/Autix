'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Camera, Loader2 } from 'lucide-react';
import { AVATAR_UPLOAD_LIMITS, OWN_PROFILE_LIMITS, type UpdateOwnProfileInput } from '@autix/domain';
import { authActions, useAuthStore } from '@autix/shared-store';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from '../ui';
import { AuthErrorAlert, AuthFieldShell } from '../auth/auth-fields';

/**
 * T13: 自助编辑 profile 基础三字段。
 *
 * - 白名单：nickname / description / avatar，其余字段前端不发送。
 * - 长度上限来自 domain 常量 OWN_PROFILE_LIMITS，与后端 DTO 校验对齐。
 * - 提交成功后 authActions.updateOwnProfile 自动 setUser，所以 useAuthStore 会立即刷新到 UI。
 * - T15.7: 提交成功后 reset(values) 让 isDirty 归位，success 3s 自动淡出。
 * - 头像统一走 upload dropzone（reservation-then-consume 的 uploadAvatar action），单一路径。
 */

interface FormValues {
  nickname: string;
  description: string;
}

const SUCCESS_FADE_MS = 3000;

export function ProfileBasicsForm() {
  const t = useTranslations('auth.profileBasics');
  const user = useAuthStore((s) => s.user);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { dirtyFields, errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      nickname: user?.nickname ?? '',
      description: user?.description ?? '',
    },
  });

  // 当 store 里的 user 变更（例如首次 hydrate 或其他 action），重置表单默认值
  useEffect(() => {
    if (user && !uploadingRef.current) {
      reset({
        nickname: user.nickname ?? '',
        description: user.description ?? '',
      });
    }
  }, [user, reset]);

  // 组件卸载时清理 success timer
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  if (!user) return null;

  const scheduleDoneFade = () => {
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    doneTimerRef.current = setTimeout(() => setDone(false), SUCCESS_FADE_MS);
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setDone(false);
    setSubmitting(true);
    try {
      // 空字符串视作 null（清空）；未修改的字段不发送
      const payload: UpdateOwnProfileInput = {};
      const originalNick = user.nickname ?? '';
      const originalDesc = user.description ?? '';
      if (values.nickname !== originalNick) payload.nickname = values.nickname === '' ? null : values.nickname;
      if (values.description !== originalDesc) payload.description = values.description === '' ? null : values.description;

      if (Object.keys(payload).length === 0) {
        setDone(true);
        scheduleDoneFade();
        return;
      }
      await authActions.updateOwnProfile(payload);
      // reset(values) 把当前提交值作为新的 defaultValues，isDirty 归 false，Save 按钮回到 disabled
      reset(values);
      setDone(true);
      scheduleDoneFade();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('errorGeneric');
      setError(Array.isArray(msg) ? msg.join('; ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  });

  /**
   * T16: 头像文件选择 handler。
   * - 前端预检 MIME 白名单和体积上限（domain 常量），避免徒劳走 presign
   * - 走 authActions.uploadAvatar 三步流水；成功后 store 会自动 setUser，表单 reset 到新 avatar
   */
  const onAvatarFileChange = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    setError(null);
    setDone(false);

    if (!(AVATAR_UPLOAD_LIMITS.allowedContentTypes as readonly string[]).includes(file.type)) {
      setError(t('errorAvatarType', { types: AVATAR_UPLOAD_LIMITS.allowedContentTypes.join(', ') }));
      evt.target.value = '';
      return;
    }
    if (file.size > AVATAR_UPLOAD_LIMITS.maxSizeBytes) {
      setError(t('errorAvatarSize', { maxMb: Math.round(AVATAR_UPLOAD_LIMITS.maxSizeBytes / 1024 / 1024) }));
      evt.target.value = '';
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setAvatarPreview(previewUrl);
    const draft = getValues();
    const dirtyDraftFields = { ...dirtyFields };
    uploadingRef.current = true;
    setUploading(true);
    try {
      const profile = await authActions.uploadAvatar(file);
      // 头像独立上传不能覆盖尚未提交的昵称或简介草稿。
      reset({
        nickname: profile.nickname ?? '',
        description: profile.description ?? '',
      });
      if (dirtyDraftFields.nickname) setValue('nickname', draft.nickname, { shouldDirty: true });
      if (dirtyDraftFields.description) setValue('description', draft.description, { shouldDirty: true });
      setDone(true);
      scheduleDoneFade();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('errorGeneric');
      setError(Array.isArray(msg) ? msg.join('; ') : String(msg));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setAvatarPreview(null);
      evt.target.value = '';
    }
  };

  const displayName = user.nickname || user.realName || user.username || user.email || '?';
  const initial = (displayName[0] || '?').toUpperCase();
  const avatarSrc = avatarPreview || user.avatar || undefined;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-6 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3 lg:items-start">
            <div className="relative">
              <Avatar className="size-24">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt={t('avatarPreviewAlt')} /> : null}
                <AvatarFallback className="text-2xl font-semibold">{initial}</AvatarFallback>
              </Avatar>
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/75" aria-label={t('avatarUploading')}>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                </div>
              ) : null}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_UPLOAD_LIMITS.allowedContentTypes.join(',')}
              onChange={onAvatarFileChange}
              disabled={submitting || uploading}
              className="sr-only"
              aria-label={t('avatarUploadLabel')}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={submitting || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
              {uploading ? t('avatarUploading') : t('avatarUploadButton')}
            </Button>
            <p className="max-w-36 text-center text-xs leading-5 text-muted-foreground lg:text-left">
              {t('avatarUploadHint', { maxMb: Math.round(AVATAR_UPLOAD_LIMITS.maxSizeBytes / 1024 / 1024) })}
            </p>
          </div>

          <div className="space-y-4">
            <AuthFieldShell id="profile-nickname" errorId="profile-nickname-error" label={t('fieldNickname')} error={errors.nickname?.message}>
              <Input
                id="profile-nickname"
                type="text"
                {...register('nickname', {
                  maxLength: {
                    value: OWN_PROFILE_LIMITS.nicknameMaxLength,
                    message: t('errorNicknameTooLong', { max: OWN_PROFILE_LIMITS.nicknameMaxLength }),
                  },
                })}
                aria-invalid={errors.nickname ? true : undefined}
                aria-describedby={errors.nickname ? 'profile-nickname-error' : undefined}
                disabled={submitting || uploading}
                placeholder={t('placeholderNickname')}
              />
            </AuthFieldShell>

            <AuthFieldShell id="profile-description" errorId="profile-description-error" label={t('fieldDescription')} error={errors.description?.message}>
              <Textarea
                id="profile-description"
                rows={4}
                {...register('description', {
                  maxLength: {
                    value: OWN_PROFILE_LIMITS.descriptionMaxLength,
                    message: t('errorDescriptionTooLong', { max: OWN_PROFILE_LIMITS.descriptionMaxLength }),
                  },
                })}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? 'profile-description-error' : undefined}
                disabled={submitting || uploading}
                placeholder={t('placeholderDescription')}
              />
            </AuthFieldShell>

            {error ? <AuthErrorAlert>{error}</AuthErrorAlert> : null}
          </div>
        </CardContent>

        <CardFooter className="min-h-14 justify-end gap-3 border-t">
          {done ? (
            <div className="mr-auto text-sm text-emerald-600 dark:text-emerald-400" role="status" aria-live="polite">
              {t('success')}
            </div>
          ) : null}
          <Button type="submit" disabled={submitting || uploading || !isDirty}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
