'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Lock, Mail, Shield, User } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
} from '../../ui';

export interface AdminProfilePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type AdminProfileNamedItem = {
  code?: string | null;
  name?: string | null;
};

export type AdminProfileListItem = string | AdminProfileNamedItem;

export interface AdminProfileUser {
  username: string;
  email: string;
  realName?: string | null;
  roles?: AdminProfileListItem[] | null;
  permissions?: AdminProfileListItem[] | null;
}

export type AdminProfilePlatform = 'web' | 'desktop';

export interface AdminProfileViewProps {
  user: AdminProfileUser | null | undefined;
  platform?: AdminProfilePlatform;
  onChangePassword: (data: AdminProfilePasswordForm) => Promise<void>;
  getPasswordErrorMessage: (error: unknown) => string;
}

function getItemKey(item: AdminProfileListItem, prefix: string, index: number) {
  return typeof item === 'string' ? item : `${prefix}-${index}`;
}

function getItemLabel(
  item: AdminProfileListItem,
  fallback: string,
) {
  return typeof item === 'string' ? item : item.code || item.name || fallback;
}

export function AdminProfileView({
  user,
  platform = 'web',
  onChangePassword,
  getPasswordErrorMessage,
}: AdminProfileViewProps) {
  const t = useTranslations('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AdminProfilePasswordForm>();

  const newPassword = watch('newPassword');
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const visiblePermissions = permissions.slice(0, 20);
  const successClassName =
    platform === 'desktop'
      ? 'text-sm p-3 rounded-lg bg-green-500/10 text-green-600'
      : 'text-sm p-3 rounded-lg bg-success/10 text-success';
  const errorClassName =
    platform === 'desktop'
      ? 'text-sm p-3 rounded-lg bg-danger/10 text-destructive'
      : 'text-sm p-3 rounded-lg bg-destructive/10 text-destructive';
  const roleBadgeVariant = platform === 'desktop' ? undefined : 'secondary';
  const permissionBadgeVariant = platform === 'desktop' ? undefined : 'outline';
  const permissionBadgeClassName =
    platform === 'desktop' ? 'font-mono' : 'text-xs font-mono';
  const overflowBadgeClassName = platform === 'desktop' ? undefined : 'text-xs';

  const onSubmit = async (data: AdminProfilePasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await onChangePassword(data);
      setMessage(t('passwordChangeSuccess'));
      reset();
    } catch (err: unknown) {
      setError(getPasswordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">
        {t('title')}
      </h1>

      <div className="grid gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="font-semibold">{t('basicInfo')}</span>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">{t('username')}</Label>
                <p className="mt-1 font-mono font-medium">{user.username}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">{t('realName')}</Label>
                <p className="mt-1 font-medium">{user.realName || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {t('email')}
                </Label>
                <p className="mt-1">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">{t('rolesAndPermissions')}</span>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-muted-foreground text-sm">{t('currentRoles')}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {roles.map((role, index) => (
                  <Badge
                    key={getItemKey(role, 'role', index)}
                    variant={roleBadgeVariant}
                  >
                    {getItemLabel(role, t('unknownRole'))}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">{t('ownedPermissions')}</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {visiblePermissions.map((perm, index) => (
                  <Badge
                    key={getItemKey(perm, 'perm', index)}
                    variant={permissionBadgeVariant}
                    className={permissionBadgeClassName}
                  >
                    {getItemLabel(perm, t('unknownPermission'))}
                  </Badge>
                ))}
                {permissions.length > 20 && (
                  <Badge
                    variant={permissionBadgeVariant}
                    className={overflowBadgeClassName}
                  >
                    +{permissions.length - 20} {t('more')}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <span className="font-semibold">{t('changePassword')}</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>{t('currentPassword')} *</Label>
                <Input
                  type="password"
                  {...register('currentPassword', { required: t('currentPasswordRequired') })}
                  placeholder="••••••••"
                />
                {errors.currentPassword && (
                  <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('newPassword')} *</Label>
                <Input
                  type="password"
                  {...register('newPassword', {
                    required: t('newPasswordRequired'),
                    minLength: { value: 6, message: t('passwordMinLength') },
                  })}
                  placeholder="••••••••"
                />
                {errors.newPassword && (
                  <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('confirmNewPassword')} *</Label>
                <Input
                  type="password"
                  {...register('confirmPassword', {
                    required: t('confirmPasswordRequired'),
                    validate: (val) => val === newPassword || t('passwordMismatch'),
                  })}
                  placeholder="••••••••"
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
              {message && (
                <div role="alert" className={successClassName}>
                  {message}
                </div>
              )}
              {error && (
                <div role="alert" className={errorClassName}>
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? t('changing') : t('changePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
