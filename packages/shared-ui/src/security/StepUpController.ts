'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { securityActions } from '@autix/shared-store';
import type { StepUpPurpose, StartStepUpResult } from '@autix/domain';

/**
 * StepUpDialog 支持的四种交互形态：
 *   - password：本地表单收集当前密码，一次性换 proof
 *   - otp：先 requestOtp → 拿到 requestId，输入验证码后 verifyOtp 换 proof
 *   - redirect：跳外部 provider 完成 re-auth（proof 会异步回落，dialog 只显示跳转按钮）
 *   - unsupported：登录方式无法 re-auth（联系客服）
 *
 * StepUpController 只负责状态编排与调用 securityActions；渲染在 StepUpDialog 里。
 */
export type StepUpModality = 'password' | 'otp' | 'redirect' | 'unsupported';
export type OAuthStepUpStartResult = StartStepUpResult | { kind: 'proof'; proof: string };
export type OAuthStepUpStarter = (purpose: StepUpPurpose) => Promise<OAuthStepUpStartResult>;

export interface StepUpControllerOptions {
  purpose: StepUpPurpose;
  /** 已登录用户是否有密码；无密码则不能走 password 分支 */
  hasPassword: boolean;
  clientType?: 'web' | 'desktop';
  redirectUri?: string;
  startOAuthStepUp?: OAuthStepUpStarter;
  /** 拿到 proof 后回调（父组件负责用 proof 走 setPassword/requestEmailChange 等业务） */
  onProof: (proof: string) => Promise<void> | void;
}

export interface StepUpState {
  open: boolean;
  loading: boolean;
  modality: StepUpModality | null;
  error: string | null;
  // OTP 分支状态
  otpRequestId: string | null;
  otpMaskedTarget: string | null;
  otpResendCooldown: number;
  otpExpiresAt: string | null;
  // Redirect 分支状态
  redirectUrl: string | null;
  redirectProvider: string | null;
  // Unsupported 分支
  unsupportedReason: 'PROVIDER_REAUTH_UNSUPPORTED' | 'CONTACT_SUPPORT' | null;
}

const INITIAL_STATE: StepUpState = {
  open: false,
  loading: false,
  modality: null,
  error: null,
  otpRequestId: null,
  otpMaskedTarget: null,
  otpResendCooldown: 0,
  otpExpiresAt: null,
  redirectUrl: null,
  redirectProvider: null,
  unsupportedReason: null,
};

export function useStepUpController(options: StepUpControllerOptions) {
  const [state, setState] = useState<StepUpState>(INITIAL_STATE);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const open = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      open: true,
      modality: optionsRef.current.hasPassword ? 'password' : null,
    });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /** password 分支：本地表单直接调用 authorizeByPassword */
  const submitPassword = useCallback(async (password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const authed = await securityActions.authorizeByPassword({
        purpose: optionsRef.current.purpose,
        password,
      });
      await optionsRef.current.onProof(authed.proof);
      setState(INITIAL_STATE);
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: describeError(err) }));
    }
  }, []);

  /** 从 password 分支切换到 OAuth 分支（用户点"没有密码/忘记密码"），触发 authorize 拿 tagged union */
  const startForOAuth = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result: OAuthStepUpStartResult = optionsRef.current.startOAuthStepUp
        ? await optionsRef.current.startOAuthStepUp(optionsRef.current.purpose)
        : await securityActions.startStepUpForOAuth({
            purpose: optionsRef.current.purpose,
            clientType: optionsRef.current.clientType,
            redirectUri: optionsRef.current.redirectUri,
          });
      if (result.kind === 'proof') {
        await optionsRef.current.onProof(result.proof);
        setState(INITIAL_STATE);
        return;
      }
      applyStartResult(result, setState);
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: describeError(err) }));
    }
  }, []);

  /** OTP 分支：请求发信 */
  const requestOtp = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await securityActions.requestOtp({ purpose: optionsRef.current.purpose });
      setState((s) => ({
        ...s,
        loading: false,
        modality: 'otp',
        otpRequestId: result.requestId,
        otpMaskedTarget: result.maskedTarget,
        otpResendCooldown: result.resendCooldownSeconds,
        otpExpiresAt: result.expiresAt,
        error: null,
      }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: describeError(err) }));
    }
  }, []);

  /** OTP 分支：verify 换 proof */
  const submitOtp = useCallback(async (code: string) => {
    const requestId = state.otpRequestId;
    if (!requestId) {
      setState((s) => ({ ...s, error: 'STEP_UP_INVALID_OR_EXPIRED' }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { proof } = await securityActions.verifyOtp({
        purpose: optionsRef.current.purpose,
        requestId,
        code,
      });
      await optionsRef.current.onProof(proof);
      setState(INITIAL_STATE);
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: describeError(err) }));
    }
  }, [state.otpRequestId]);

  // Resend cooldown tick（1s 递减）
  useEffect(() => {
    if (!state.open) return;
    if (state.otpResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setState((s) => ({ ...s, otpResendCooldown: Math.max(0, s.otpResendCooldown - 1) }));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.open, state.otpResendCooldown]);

  return {
    state,
    actions: {
      open,
      close,
      submitPassword,
      startForOAuth,
      requestOtp,
      submitOtp,
    },
  };
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as { response?: { data?: { code?: string } }; message?: string };
    return anyErr.response?.data?.code ?? anyErr.message ?? 'STEP_UP_INVALID_OR_EXPIRED';
  }
  return 'STEP_UP_INVALID_OR_EXPIRED';
}

function applyStartResult(
  result: StartStepUpResult,
  setState: React.Dispatch<React.SetStateAction<StepUpState>>,
): void {
  if (result.kind === 'otp') {
    setState((s) => ({
      ...s,
      loading: false,
      modality: 'otp',
      otpRequestId: result.requestId,
      otpMaskedTarget: result.maskedTarget,
      otpResendCooldown: result.resendCooldownSeconds,
      otpExpiresAt: result.expiresAt,
    }));
  } else if (result.kind === 'redirect') {
    setState((s) => ({
      ...s,
      loading: false,
      modality: 'redirect',
      redirectUrl: result.authorizeUrl,
      redirectProvider: result.provider,
    }));
  } else if (result.kind === 'unsupported') {
    setState((s) => ({
      ...s,
      loading: false,
      modality: 'unsupported',
      unsupportedReason: result.reason,
    }));
  }
}
