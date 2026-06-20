type ApiErrorLike = {
  msg?: unknown;
  response?: {
    data?: {
      msg?: unknown;
      message?: unknown;
    };
  };
};

const asApiError = (error: unknown): ApiErrorLike =>
  error && typeof error === 'object' ? (error as ApiErrorLike) : {};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const getLoginErrorMessage = (error: unknown, fallback: string) => {
  const e = asApiError(error);
  return asString(e.msg) || asString(e.response?.data?.msg) || fallback;
};

export const getRegisterErrorMessage = (error: unknown, fallback: string) => {
  const e = asApiError(error);
  const msg = e.msg ?? e.response?.data?.msg;
  if (Array.isArray(msg)) return msg.join(', ');
  return asString(msg) || fallback;
};

export const getResetPasswordErrorMessage = (error: unknown, fallback: string) => {
  const e = asApiError(error);
  return asString(e.msg) || asString(e.response?.data?.msg) || fallback;
};

export const getActivationErrorMessage = (error: unknown, fallback: string) => {
  const e = asApiError(error);
  return asString(e.msg) || asString(e.response?.data?.message) || fallback;
};

export const getResendActivationMessage = (error: unknown, fallback: string) => {
  const e = asApiError(error);
  return asString(e.msg) || asString(e.response?.data?.msg) || fallback;
};
