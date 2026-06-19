'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { User, Lock, Mail, Shield } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Label, Badge } from '@autix/shared-ui/ui';
import { useAuthStore } from '@autix/shared-store';
import { userApi as api } from '@autix/sdk';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordForm>();

  const newPassword = watch('newPassword');

  const onSubmit = async (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.post('/auth/change-password', {
        oldPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setMessage(t('passwordChangeSuccess'));
      reset();
    } catch (err: any) {
      setError(err.response?.data?.message || t('passwordChangeFailed'));
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
                {(Array.isArray(user.roles) ? user.roles : []).map((role: any, index: number) => (
                  <Badge
                    key={typeof role === 'string' ? role : `role-${index}`}
                    variant="secondary"
                  >
                    {typeof role === 'string' ? role : (role.code || role.name || t('unknownRole'))}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">{t('ownedPermissions')}</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Array.isArray(user.permissions) ? user.permissions.slice(0, 20) : []).map((perm: any, index: number) => (
                  <Badge
                    key={typeof perm === 'string' ? perm : `perm-${index}`}
                    variant="outline"
                    className="text-xs font-mono"
                  >
                    {typeof perm === 'string' ? perm : perm.code || perm.name || t('unknownPermission')}
                  </Badge>
                ))}
                {user.permissions && user.permissions.length > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{user.permissions.length - 20} {t('more')}
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
                <div role="alert" className="text-sm p-3 rounded-lg bg-success/10 text-success">
                  {message}
                </div>
              )}
              {error && (
                <div role="alert" className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
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
