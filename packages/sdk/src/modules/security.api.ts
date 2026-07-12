import type {
  AuthProfile,
  StepUpPurpose,
  StartStepUpResult,
  StepUpAuthorizeInput,
  StepUpOtpRequestInput,
  StepUpOtpVerifyInput,
} from '@autix/domain';
import { userApi } from '../client';

// ── ErrorCode 契约 ────────────────────────────────────────────────────────
// 后端 StepUpHttpException / RateLimitedException / EmailChangeService 会返回
// { code, message } 载荷；SDK 侧统一为字符串联合，前端可基于此 code 做 i18n 映射。
export type AuthSelfServiceErrorCode =
  | 'STEP_UP_INVALID_OR_EXPIRED'
  | 'STEP_UP_UNAVAILABLE'
  | 'OTP_INVALID'
  | 'OTP_LOCKED'
  | 'OTP_ALREADY_CONSUMED'
  | 'TOO_MANY_REQUESTS'
  | 'USER_DELETED'
  | 'ACCOUNT_DELETE_CONFIRMATION_MISMATCH';

export interface AuthErrorPayload {
  code: AuthSelfServiceErrorCode | string;
  message: string;
  retryAfterMs?: number;
}

// ── Step-up：password 分支（tagged union 之外的返回形态）─────────────────
export interface StepUpPasswordAuthorized {
  kind: 'password';
  proof: string;
  expiresAt: string;
}

export type StepUpAuthorizeResponse =
  | StepUpPasswordAuthorized
  | StartStepUpResult;

/**
 * POST /auth/step-up/authorize
 * - 提交 password → 返回 { kind:'password', proof, expiresAt }
 * - 不提交 password → 返回 { kind:'redirect'|'otp'|'unsupported' } 由 OAuth 分支决定
 */
export const stepUpAuthorize = (input: StepUpAuthorizeInput & { password?: string }) =>
  userApi.post<StepUpAuthorizeResponse>('/auth/step-up/authorize', input);

/** POST /auth/step-up/otp/request → 返回 kind='otp' 分支的完整信息 */
export const stepUpRequestOtp = (input: StepUpOtpRequestInput) =>
  userApi.post<Extract<StartStepUpResult, { kind: 'otp' }>>('/auth/step-up/otp/request', input);

/** POST /auth/step-up/otp/verify → 命中签发 { proof, expiresAt } */
export const stepUpVerifyOtp = (input: StepUpOtpVerifyInput) =>
  userApi.post<{ proof: string; expiresAt: string }>('/auth/step-up/otp/verify', input);

// ── 密码设置 / 修改 ──────────────────────────────────────────────────────
export interface SetOrChangePasswordInput {
  proof: string;
  newPassword: string;
}
export const setOrChangePassword = (input: SetOrChangePasswordInput) =>
  userApi.post<AuthProfile>('/auth/password', input);

// ── 邮箱变更（必带 proof）+ 首次补录（无需 proof）─────────────────────────
export interface RequestEmailChangeInput {
  email: string;
  proof: string;
}
export const requestEmailChange = (input: RequestEmailChangeInput) =>
  userApi.post<AuthProfile>('/auth/email/change', input);

/** OAuth 首次登录后补邮箱：只在 user.email 为空时可用 */
export const requestEmailSupplement = (email: string) =>
  userApi.post<{ message?: string }>('/auth/email', { email });

/** 公开：邮件回调确认 */
export const confirmEmailChange = (token: string) =>
  userApi.post<{ message?: string }>('/auth/email/confirm', { token });

// ── 账户注销（立即、不可逆匿名化）────────────────────────────────────────
export interface DeleteAccountInput {
  proof: string;
  usernameConfirmation: string;
}
export interface DeleteAccountResponse {
  message?: string;
  deletedAt: string;
}
export const deleteAccount = (input: DeleteAccountInput) =>
  userApi.delete<DeleteAccountResponse>('/auth/account', { data: input });

// ── Step-up purpose export ───────────────────────────────────────────────
export type { StepUpPurpose };
