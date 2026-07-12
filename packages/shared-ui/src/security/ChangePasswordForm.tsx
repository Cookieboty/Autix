'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { securityActions } from '@autix/shared-store';
import { Button, Input } from '../ui';
import { AuthErrorAlert, AuthFieldShell, AuthInfoBox } from '../auth/auth-fields';
import { StepUpDialog } from './StepUpDialog';
import { translateAuthError } from './error-map';
import type { OAuthStepUpStarter } from './StepUpController';
/**
 * ChangePasswordForm 使用 tri-state：
 *   idle → 用户填写"新密码 + 确认密码" → 点提交
 *   pendingStepUp → 弹 StepUpDialog；用户通过 password/OTP/redirect 换回 proof
 *   submitting → 调 setOrChangePassword
 *   done → 显示成功 banner
 *
 * 首次设置密码（hasPassword=false）与修改密码共享同一 form，只是 stepUp purpose 与文案不同。
 */
export interface ChangePasswordFormProps {
  hasPassword: boolean;
  startOAuthStepUp?: OAuthStepUpStarter;
}

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordForm(props: ChangePasswordFormProps) {
  const t = useTranslations('auth.changePassword');
  const tRoot = useTranslations();
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>();
  const newPassword = watch('newPassword');

  const onSubmit = (values: FormValues) => {
    setError(null);
    setPendingValues(values);
    setStepUpOpen(true);
  };

  const onProof = async (proof: string) => {
    if (!pendingValues) return;
    setSubmitting(true);
    setError(null);
    try {
      await securityActions.setOrChangePassword({ proof, newPassword: pendingValues.newPassword });
      setDone(true);
      reset();
      setPendingValues(null);
    } catch (err) {
      setError(translateAuthError(err, (key: string) => tRoot(key), t('submit')));
    } finally {
      setSubmitting(false);
      setStepUpOpen(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-3">
        <AuthInfoBox>{t('success')}</AuthInfoBox>
        <Button variant="outline" onClick={() => setDone(false)}>
          {props.hasPassword ? t('title') : t('titleSet')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          {props.hasPassword ? t('title') : t('titleSet')}
        </h3>
        {!props.hasPassword ? (
          <p className="text-xs text-muted-foreground">{t('descSet')}</p>
        ) : null}

        <AuthFieldShell id="np" label={t('new')} error={errors.newPassword?.message}>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            {...register('newPassword', {
              required: t('new'),
              minLength: { value: 8, message: t('tooWeak') },
              pattern: {
                value: /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: t('tooWeak'),
              },
            })}
          />
        </AuthFieldShell>

        <AuthFieldShell id="cp" label={t('confirm')} error={errors.confirmPassword?.message}>
          <Input
            id="cp"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword', {
              required: t('confirm'),
              validate: (v) => v === newPassword || t('tooWeak'),
            })}
          />
        </AuthFieldShell>

        {error ? <AuthErrorAlert>{error}</AuthErrorAlert> : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </form>

      {/* Step-up 授权弹窗；仅当有 pendingValues 且用户点开时挂载 */}
      {pendingValues ? (
        <StepUpDialog
          purpose={props.hasPassword ? 'change-password' : 'set-password'}
          hasPassword={props.hasPassword}
          onProof={onProof}
          startOAuthStepUp={props.startOAuthStepUp}
          open={stepUpOpen}
          onOpenChange={setStepUpOpen}
        />
      ) : null}
    </>
  );
}
