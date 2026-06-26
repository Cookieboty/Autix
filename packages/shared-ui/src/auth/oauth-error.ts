const MAP: Record<string, string> = {
  OAUTH_EMAIL_UNVERIFIED_CONFLICT: 'oauthEmailConflict',
  OAUTH_ACCOUNT_ALREADY_LINKED: 'oauthAlreadyLinked',
  OAUTH_CANNOT_UNLINK_LAST_CREDENTIAL: 'oauthCannotUnlinkLast',
  OAUTH_PROVIDER_DISABLED: 'oauthProviderDisabled',
  OAUTH_STATE_INVALID: 'oauthStateInvalid',
  OAUTH_EXCHANGE_EXPIRED: 'oauthExpired',
  OAUTH_REDIRECT_NOT_ALLOWED: 'oauthRedirectNotAllowed',
};

export function mapOAuthErrorKey(code: string | null | undefined): string {
  return (code && MAP[code]) || 'oauthGenericError';
}
