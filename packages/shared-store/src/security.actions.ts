import type {
  AuthProfile,
  StepUpPurpose,
  StartStepUpResult,
} from '@autix/domain';
import {
  stepUpAuthorize,
  stepUpRequestOtp,
  stepUpVerifyOtp,
  setOrChangePassword as apiSetOrChangePassword,
  requestEmailChange as apiRequestEmailChange,
  requestEmailSupplement as apiRequestEmailSupplement,
  confirmEmailChange as apiConfirmEmailChange,
  deleteAccount as apiDeleteAccount,
  type StepUpAuthorizeResponse,
  type StepUpPasswordAuthorized,
  type DeleteAccountResponse,
} from '@autix/sdk';
import { pickAuthUser, useAuthStore } from './auth.store';

function applyProfile(profile: AuthProfile): AuthProfile {
  useAuthStore.getState().setUser(
    pickAuthUser(profile),
    profile.menus ?? [],
    profile.systems ?? [],
    profile.features ?? {},
  );
  return profile;
}

/**
 * 账户自服务（安全）actions —— 覆盖 step-up 授权、密码闭环、邮箱补录/变更。
 *
 * 设计：不引入新的 store，避免与 useAuthStore 竞争同一 user 状态。
 * 所有 mutation 结果都以 Promise 返回给调用方（UI/hook），后者可自己决定是否触发 refreshProfile()。
 */
export const securityActions = {
  /**
   * 密码分支的 step-up 授权。命中即拿到 password proof，可直接投递到 setPassword/changeEmail 等业务端点。
   */
  authorizeByPassword: async (input: {
    purpose: StepUpPurpose;
    password: string;
  }): Promise<StepUpPasswordAuthorized> => {
    const { data } = await stepUpAuthorize(input);
    if (data.kind !== 'password') {
      throw new Error(`Unexpected step-up response kind: ${data.kind}`);
    }
    return data;
  },

  /**
   * OAuth-only 用户的 step-up 启动：返回 tagged union，UI 根据 kind 分派到 OTP 或 redirect 或 unsupported。
   */
  startStepUpForOAuth: async (input: {
    purpose: StepUpPurpose;
    clientType?: 'web' | 'desktop';
    redirectUri?: string;
    provider?: string;
    preferEmailOtp?: boolean;
  }): Promise<StartStepUpResult> => {
    const { data } = await stepUpAuthorize(input);
    if (data.kind === 'password') {
      throw new Error('OAuth flow should not receive password kind');
    }
    return data;
  },

  /**
   * 请求 OTP：写 email_otps 并发信；返回 { requestId, maskedTarget, resendCooldownSeconds, expiresAt }。
   */
  requestOtp: async (input: {
    purpose: StepUpPurpose;
  }): Promise<Extract<StartStepUpResult, { kind: 'otp' }>> => {
    const { data } = await stepUpRequestOtp(input);
    return data;
  },

  /**
   * 校验 OTP：命中即换回 { proof, expiresAt }。
   */
  verifyOtp: async (input: {
    purpose: StepUpPurpose;
    requestId: string;
    code: string;
  }): Promise<{ proof: string; expiresAt: string }> => {
    const { data } = await stepUpVerifyOtp(input);
    return data;
  },

  /**
   * 使用已获取的 proof 设置或修改密码。
   * 后端会：
   *   1) verifyProof(proof, userId, 'change-password' 或 'set-password')
   *   2) bcrypt hash + updatePassword
   *   3) 撤销除当前 session 外的所有 session
   */
  setOrChangePassword: async (input: {
    proof: string;
    newPassword: string;
  }): Promise<AuthProfile> => {
    const { data } = await apiSetOrChangePassword(input);
    return applyProfile(data);
  },

  /**
   * 使用 proof 请求邮箱变更（有原邮箱）。
   */
  requestEmailChange: async (input: {
    email: string;
    proof: string;
  }): Promise<AuthProfile> => {
    const { data } = await apiRequestEmailChange(input);
    return applyProfile(data);
  },

  /**
   * OAuth 首次登录后补邮箱（原邮箱为空）。不要求 proof。
   */
  requestEmailSupplement: async (email: string): Promise<void> => {
    await apiRequestEmailSupplement(email);
  },

  /**
   * 公开接口：邮箱变更/补录邮件回调。
   */
  confirmEmailChange: async (token: string): Promise<void> => {
    await apiConfirmEmailChange(token);
  },

  /**
   * 使用 step-up proof（purpose='delete-account'）申请注销账户。
   * 成功后后端已吊销所有 session，前端应清 token 并跳登录页。
   */
  deleteAccount: async (input: { proof: string; usernameConfirmation: string }): Promise<DeleteAccountResponse> => {
    const { data } = await apiDeleteAccount(input);
    return data;
  },

};

// 便于测试与错误处理：暴露 password 分支类型
export type { StepUpAuthorizeResponse };
