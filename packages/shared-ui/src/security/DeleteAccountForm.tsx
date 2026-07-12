'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { securityActions, useAuthStore } from '@autix/shared-store';
import { Button, Input } from '../ui';
import { AuthErrorAlert, AuthFieldShell, AuthInfoBox } from '../auth/auth-fields';
import { StepUpDialog } from './StepUpDialog';
import { translateAuthError } from './error-map';
import type { OAuthStepUpStarter } from './StepUpController';

/**
 * DeleteAccountForm 三态：
 *   idle → 用户输入用户名 + 勾选确认 → 提交
 *   pendingStepUp → StepUpDialog 换 delete-account proof
 *   submitting → securityActions.deleteAccount({ proof, usernameConfirmation })
 *   done → 显示成功；父层由 onDeleted 回调决定跳登录
 *
 * 前提：调用方需保证已登录且拿到 currentUsername。前后端都会校验用户名确认，
 * 避免绕过 UI 直接调用破坏性接口。
 */
export interface DeleteAccountFormProps {
  currentUsername: string;
  hasPassword: boolean;
  onDeleted?: (result: { deletedAt: string }) => void;
  startOAuthStepUp?: OAuthStepUpStarter;
}

interface FormValues {
  usernameConfirm: string;
  ackIrreversible: boolean;
}

export function DeleteAccountForm(props: DeleteAccountFormProps) {
  const t = useTranslations('auth.deleteAccount');
  const tRoot = useTranslations();
  const [pendingConfirmed, setPendingConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({ mode: 'onChange', defaultValues: { usernameConfirm: '', ackIrreversible: false } });

  const onSubmit = () => {
    setError(null);
    setPendingConfirmed(true);
    setStepUpOpen(true);
  };

  const onProof = async (proof: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await securityActions.deleteAccount({
        proof,
        usernameConfirmation: props.currentUsername,
      });
      setDone(true);
      // 后端已吊销所有 session；前端主动清理 auth store 并跳回登录
      try { await useAuthStore.getState().logout(); } catch { /* noop */ }
      props.onDeleted?.({ deletedAt: result.deletedAt });
    } catch (err) {
      setError(translateAuthError(err, (key: string) => tRoot(key), t('confirm')));
    } finally {
      setSubmitting(false);
      setStepUpOpen(false);
    }
  };

  if (done) {
    return <AuthInfoBox>{t('success')}</AuthInfoBox>;
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <h3 className="text-sm font-semibold text-destructive">{t('sectionTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('sectionHint')}</p>

        <AuthFieldShell id="uc" label={t('dialogHint', { username: props.currentUsername })} error={errors.usernameConfirm?.message}>
          <Input
            id="uc"
            autoComplete="off"
            placeholder={t('usernamePlaceholder')}
            {...register('usernameConfirm', {
              required: t('usernamePlaceholder'),
              validate: (v) => v === props.currentUsername || t('usernamePlaceholder'),
            })}
          />
        </AuthFieldShell>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            {...register('ackIrreversible', { required: true })}
          />
          <span>{t('checkboxIrreversible')}</span>
        </label>

        {error ? <AuthErrorAlert>{error}</AuthErrorAlert> : null}

        <Button
          type="submit"
          variant="destructive"
          disabled={!isValid || submitting}
        >
          {submitting ? t('processing') : t('openDialog')}
        </Button>
      </form>

      {pendingConfirmed ? (
        <StepUpDialog
          purpose="delete-account"
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
