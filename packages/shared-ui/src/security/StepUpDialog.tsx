'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { StepUpControllerOptions } from './StepUpController';
import { useStepUpController } from './StepUpController';
import { AUTH_ERROR_CODE_I18N } from './error-map';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../ui';

/**
 * StepUpDialog：账户高危操作复核对话框。
 * 四种交互形态：
 *   - password：本地输入当前密码 → authorize 换 proof
 *   - otp：requestOtp → 输入 6 位码 → verifyOtp 换 proof
 *   - redirect：跳外部 provider（proof 由回调 URL 落地，dialog 内只显示跳转按钮）
 *   - unsupported：登录方式无法 re-auth（联系客服）
 *
 * 受控 open：由父组件传 `open` + `onOpenChange`；hook internal state 只在 open=true 时初始化。
 */
export interface StepUpDialogProps extends StepUpControllerOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StepUpDialog(props: StepUpDialogProps) {
  const t = useTranslations();
  const controller = useStepUpController(props);
  const { state, actions } = controller;
  const errorKey = state.error
    ? AUTH_ERROR_CODE_I18N[state.error as keyof typeof AUTH_ERROR_CODE_I18N]
    : undefined;

  // 外部 open 打开 → 触发 controller.open() 初始化 modality
  useEffect(() => {
    if (props.open && !state.open) actions.open();
    if (!props.open && state.open) actions.close();
  }, [props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('auth.stepUp.title')}</DialogTitle>
          <StepUpDescription state={state} />
        </DialogHeader>
        <StepUpBody state={state} actions={actions} />
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {errorKey ? t(errorKey) : state.error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)} disabled={state.loading}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepUpDescription({ state }: { state: ReturnType<typeof useStepUpController>['state'] }) {
  const t = useTranslations('auth.stepUp');
  if (state.modality === 'redirect' && state.redirectProvider) {
    return <DialogDescription>{t('descRedirect', { provider: state.redirectProvider })}</DialogDescription>;
  }
  if (state.modality === 'otp' && state.otpMaskedTarget) {
    return (
      <DialogDescription>
        {t('descOtp', { email: state.otpMaskedTarget, minutes: 5 })}
      </DialogDescription>
    );
  }
  if (state.modality === 'unsupported') {
    return <DialogDescription>{t('descUnsupported')}</DialogDescription>;
  }
  return null;
}

function StepUpBody({
  state,
  actions,
}: {
  state: ReturnType<typeof useStepUpController>['state'];
  actions: ReturnType<typeof useStepUpController>['actions'];
}) {
  const t = useTranslations('auth.stepUp');
  if (state.modality === 'password') return <PasswordBody state={state} actions={actions} />;
  if (state.modality === 'otp') return <OtpBody state={state} actions={actions} />;
  if (state.modality === 'redirect') return <RedirectBody state={state} actions={actions} />;
  if (state.modality === 'unsupported') return <UnsupportedBody />;
  // modality === null → OAuth-only 用户：只显示 startForOAuth 触发按钮
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={actions.startForOAuth} disabled={state.loading}>
        {state.loading ? t('verifying') : t('buttonSendOtp')}
      </Button>
    </div>
  );
}

function PasswordBody({
  state,
  actions,
}: {
  state: ReturnType<typeof useStepUpController>['state'];
  actions: ReturnType<typeof useStepUpController>['actions'];
}) {
  const t = useTranslations('auth');
  const [password, setPassword] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    void actions.submitPassword(password);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="stepup-password" className="text-sm font-medium">
        {t('changePassword.current')}
      </label>
      <Input
        id="stepup-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('changePassword.currentPlaceholder')}
        disabled={state.loading}
      />
      <Button type="submit" disabled={state.loading || !password}>
        {state.loading ? t('stepUp.verifying') : t('login')}
      </Button>
    </form>
  );
}

function OtpBody({
  state,
  actions,
}: {
  state: ReturnType<typeof useStepUpController>['state'];
  actions: ReturnType<typeof useStepUpController>['actions'];
}) {
  const t = useTranslations('auth.stepUp');
  const [code, setCode] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    void actions.submitOtp(code);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="stepup-otp" className="text-sm font-medium">
        {t('codeLabel')}
      </label>
      <Input
        id="stepup-otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder={t('codePlaceholder')}
        disabled={state.loading}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={state.loading || code.length !== 6}>
          {state.loading ? t('verifying') : t('buttonSendOtp')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={state.loading || state.otpResendCooldown > 0}
          onClick={actions.requestOtp}
        >
          {state.otpResendCooldown > 0
            ? t('buttonResendOtp', { seconds: state.otpResendCooldown })
            : t('buttonSendOtp')}
        </Button>
      </div>
    </form>
  );
}

function RedirectBody({
  state,
  actions,
}: {
  state: ReturnType<typeof useStepUpController>['state'];
  actions: ReturnType<typeof useStepUpController>['actions'];
}) {
  const t = useTranslations('auth.stepUp');
  if (!state.redirectUrl || !state.redirectProvider) return null;
  return (
    <Button type="button" onClick={actions.startForOAuth} disabled={state.loading}>
      {t('buttonRedirect', { provider: state.redirectProvider })}
    </Button>
  );
}

function UnsupportedBody() {
  const t = useTranslations('auth.stepUp');
  return (
    <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
      {t('contactSupport')}
    </div>
  );
}
