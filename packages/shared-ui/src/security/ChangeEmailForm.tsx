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
 * ChangeEmailForm
 * - 当 `currentEmail` 为空/null → supplement 分支：无需 step-up，直接 requestEmailSupplement
 * - 当 `currentEmail` 有值 → change 分支：走 StepUpDialog 拿 proof，再 requestEmailChange
 * - 提交成功后展示 pending banner，等用户点击邮件里的确认链接
 */
export interface ChangeEmailFormProps {
  currentEmail: string | null | undefined;
  /** 用户当前是否设置了密码（决定 stepUp 能否走 password 分支） */
  hasPassword: boolean;
  /** pendingEmail：如果后端已存在待生效变更，展示 "pending" 状态 */
  pendingEmail?: string | null;
  startOAuthStepUp?: OAuthStepUpStarter;
}

interface FormValues {
  email: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ChangeEmailForm(props: ChangeEmailFormProps) {
  const t = useTranslations('auth.changeEmail');
  const tRoot = useTranslations();
  const isSupplement = !props.currentEmail;

  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBanner, setPendingBanner] = useState<string | null>(props.pendingEmail ?? null);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (isSupplement) {
      // supplement 分支：直接提交
      setSubmitting(true);
      try {
        await securityActions.requestEmailSupplement(values.email);
        setPendingBanner(values.email);
        reset();
      } catch (err) {
        setError(translateAuthError(err, (key) => tRoot(key), t('taken')));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // change 分支：先弹 step-up
    setPendingValues(values);
    setStepUpOpen(true);
  };

  const onProof = async (proof: string) => {
    if (!pendingValues) return;
    setSubmitting(true);
    setError(null);
    try {
      await securityActions.requestEmailChange({ email: pendingValues.email, proof });
      setPendingBanner(pendingValues.email);
      reset();
      setPendingValues(null);
    } catch (err) {
      setError(translateAuthError(err, (key) => tRoot(key), t('taken')));
    } finally {
      setSubmitting(false);
      setStepUpOpen(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>

        {props.currentEmail ? (
          <div className="text-xs text-muted-foreground">
            {t('current')}：{props.currentEmail}
          </div>
        ) : null}

        {pendingBanner ? (
          <AuthInfoBox>{t('pending', { email: pendingBanner })}</AuthInfoBox>
        ) : null}

        <AuthFieldShell id="new-email" label={t('new')} error={errors.email?.message}>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            placeholder={t('newPlaceholder')}
            {...register('email', {
              required: t('newPlaceholder'),
              pattern: { value: EMAIL_RE, message: t('taken') },
            })}
          />
        </AuthFieldShell>

        {error ? <AuthErrorAlert>{error}</AuthErrorAlert> : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? tRoot('common.processing') : t('title')}
        </Button>
      </form>

      {/* 仅 change 分支需要 step-up 弹窗 */}
      {!isSupplement && pendingValues ? (
        <StepUpDialog
          purpose="change-email"
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
