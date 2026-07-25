import { readBooleanEnv } from '../common/env-flags';

export type SystemSettingType = 'boolean' | 'string';
export type SystemSettingCategory =
  | 'features'
  | 'integration'
  | 'payments'
  | 'storage'
  | 'mail'
  | 'oauth';

export interface SystemSettingDefinition {
  key: string;
  label: string;
  description: string;
  type: SystemSettingType;
  category: SystemSettingCategory;
  editable: boolean;
  sensitive?: boolean;
  allowEmpty?: boolean;
  envKeys: string[];
  defaultValue: string;
}

function envString(keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && value !== '') return value;
  }
  return fallback;
}

function envBoolean(keys: string[], fallback: boolean): string {
  return String(readBooleanEnv(keys, fallback));
}

export const SYSTEM_SETTING_DEFINITIONS: SystemSettingDefinition[] = [
  {
    key: 'features.chatEnabled',
    label: 'Chat Feature',
    description: 'Controls Chat conversations, the arena, conversation resource activation, and the homepage workstation entry.',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_CHAT', 'CHAT_ENABLED'],
    defaultValue: envBoolean(['ENABLE_CHAT', 'CHAT_ENABLED'], true),
  },
  {
    key: 'features.libraryEnabled',
    label: 'Library Feature',
    description: 'Controls the library page, document upload processing, document retrieval, and related entry points.',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_LIBRARY', 'LIBRARY_ENABLED'],
    defaultValue: envBoolean(['ENABLE_LIBRARY', 'LIBRARY_ENABLED'], true),
  },
  {
    key: 'features.inviteSharingEnabled',
    label: 'Invite & Sharing Feature',
    description: 'Controls invite links, invite code registration, and invite reward settlement.',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_INVITE_SHARING', 'INVITE_SHARING_ENABLED'],
    defaultValue: envBoolean(['ENABLE_INVITE_SHARING', 'INVITE_SHARING_ENABLED'], true),
  },
  {
    key: 'payments.webAppUrl',
    label: 'Web App URL',
    description: 'Frontend base URL used for scenarios such as payment success and cancellation redirects.',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['WEB_APP_URL'],
    defaultValue: envString(['WEB_APP_URL'], 'http://localhost:3100'),
  },
  {
    key: 'payments.stripeSecretKey',
    label: 'Stripe Secret Key',
    description: 'Stripe API secret key; it will not be shown in plaintext in the admin after saving.',
    type: 'string',
    category: 'payments',
    editable: true,
    sensitive: true,
    allowEmpty: true,
    envKeys: ['STRIPE_SECRET_KEY'],
    defaultValue: envString(['STRIPE_SECRET_KEY'], ''),
  },
  {
    key: 'payments.stripeTestModeEnabled',
    label: 'Stripe Test Mode',
    description: 'When enabled, requires using a Stripe sandbox/test API key to avoid accidentally using a live key in development.',
    type: 'boolean',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_TEST_MODE'],
    defaultValue: envBoolean(['STRIPE_TEST_MODE'], false),
  },
  {
    key: 'payments.stripeWebhookSecret',
    label: 'Stripe Webhook Secret',
    description: 'Stripe webhook signature verification secret; it will not be shown in plaintext in the admin after saving.',
    type: 'string',
    category: 'payments',
    editable: true,
    sensitive: true,
    allowEmpty: true,
    envKeys: ['STRIPE_WEBHOOK_SECRET'],
    defaultValue: envString(['STRIPE_WEBHOOK_SECRET'], ''),
  },
  {
    key: 'payments.stripeCurrency',
    label: 'Stripe Settlement Currency',
    description: 'Currency used when submitting payment orders to Stripe, e.g. USD, JPY.',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_CURRENCY'],
    defaultValue: envString(['STRIPE_CURRENCY'], 'USD'),
  },
  {
    key: 'payments.stripeApiBase',
    label: 'Stripe API URL',
    description: 'Stripe API base URL; defaults to the official API.',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_API_BASE'],
    defaultValue: envString(['STRIPE_API_BASE'], 'https://api.stripe.com'),
  },
  {
    key: 'payments.stripeSuccessUrl',
    label: 'Payment Success Redirect',
    description: 'Redirect URL after a successful Stripe Checkout payment.',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_SUCCESS_URL'],
    defaultValue: envString(
      ['STRIPE_SUCCESS_URL'],
      `${envString(['WEB_APP_URL'], 'http://localhost:3100')}/membership/orders/checkout?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    ),
  },
  {
    key: 'payments.stripeCancelUrl',
    label: 'Payment Cancel Redirect',
    description: 'Redirect URL after the user cancels payment in Stripe Checkout.',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_CANCEL_URL'],
    defaultValue: envString(
      ['STRIPE_CANCEL_URL'],
      `${envString(['WEB_APP_URL'], 'http://localhost:3100')}/membership/orders/checkout?checkout=cancelled`,
    ),
  },
  {
    key: 'payments.stripeWebhookToleranceSeconds',
    label: 'Webhook Time Tolerance (seconds)',
    description: 'Maximum allowed deviation in seconds for the Stripe webhook signature timestamp.',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_WEBHOOK_TOLERANCE_SECONDS'],
    defaultValue: envString(['STRIPE_WEBHOOK_TOLERANCE_SECONDS'], '300'),
  },
  {
    key: 'storage.r2BucketName',
    label: 'R2 Bucket',
    description: 'Cloudflare R2 bucket name.',
    type: 'string',
    category: 'storage',
    editable: true,
    allowEmpty: true,
    envKeys: ['R2_BUCKET_NAME'],
    defaultValue: envString(['R2_BUCKET_NAME'], ''),
  },
  {
    key: 'storage.r2PublicUrl',
    label: 'R2 Public Access Domain',
    description: 'Domain used to build the public access URL after an object is uploaded.',
    type: 'string',
    category: 'storage',
    editable: true,
    allowEmpty: true,
    envKeys: ['DOMAIN', 'R2_PUBLIC_URL'],
    defaultValue: envString(['DOMAIN', 'R2_PUBLIC_URL'], ''),
  },
  {
    key: 'storage.r2Endpoint',
    label: 'R2 S3 Endpoint',
    description: 'Cloudflare R2 S3-compatible API URL.',
    type: 'string',
    category: 'storage',
    editable: true,
    allowEmpty: true,
    envKeys: ['S3_API', 'R2_ENDPOINT'],
    defaultValue: envString(['S3_API', 'R2_ENDPOINT'], ''),
  },
  {
    key: 'storage.r2AccessKeyId',
    label: 'R2 Access Key ID',
    description: 'Cloudflare R2 Access Key ID; it will not be shown in plaintext in the admin after saving.',
    type: 'string',
    category: 'storage',
    editable: true,
    sensitive: true,
    allowEmpty: true,
    envKeys: ['Access_key_ID', 'R2_ACCESS_KEY_ID'],
    defaultValue: envString(['Access_key_ID', 'R2_ACCESS_KEY_ID'], ''),
  },
  {
    key: 'storage.r2SecretAccessKey',
    label: 'R2 Secret Access Key',
    description: 'Cloudflare R2 Secret Access Key; it will not be shown in plaintext in the admin after saving.',
    type: 'string',
    category: 'storage',
    editable: true,
    sensitive: true,
    allowEmpty: true,
    envKeys: ['Secret_Access_Key', 'R2_SECRET_ACCESS_KEY'],
    defaultValue: envString(['Secret_Access_Key', 'R2_SECRET_ACCESS_KEY'], ''),
  },
  {
    key: 'mail.smtpHost',
    label: 'SMTP Host',
    description: 'Mail service host; when left empty, the system skips sending email.',
    type: 'string',
    category: 'mail',
    editable: true,
    allowEmpty: true,
    envKeys: ['SMTP_HOST'],
    defaultValue: envString(['SMTP_HOST'], ''),
  },
  {
    key: 'mail.smtpPort',
    label: 'SMTP Port',
    description: 'Mail service port.',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['SMTP_PORT'],
    defaultValue: envString(['SMTP_PORT'], '465'),
  },
  {
    key: 'mail.smtpSecure',
    label: 'SMTP SSL/TLS',
    description: 'Controls whether the SMTP connection uses SSL/TLS.',
    type: 'boolean',
    category: 'mail',
    editable: true,
    envKeys: ['SMTP_SECURE'],
    defaultValue: envBoolean(['SMTP_SECURE'], true),
  },
  {
    key: 'mail.smtpUser',
    label: 'SMTP Username',
    description: 'Mail service login username.',
    type: 'string',
    category: 'mail',
    editable: true,
    allowEmpty: true,
    envKeys: ['SMTP_USER'],
    defaultValue: envString(['SMTP_USER'], ''),
  },
  {
    key: 'mail.smtpPass',
    label: 'SMTP Password',
    description: 'Mail service login password; it will not be shown in plaintext in the admin after saving.',
    type: 'string',
    category: 'mail',
    editable: true,
    sensitive: true,
    allowEmpty: true,
    envKeys: ['SMTP_PASS'],
    defaultValue: envString(['SMTP_PASS'], ''),
  },
  {
    key: 'mail.smtpFrom',
    label: 'Sender',
    description: 'Sender address shown on system emails.',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['SMTP_FROM'],
    defaultValue: envString(['SMTP_FROM'], 'Autix <noreply@example.com>'),
  },
  {
    key: 'mail.passwordResetBaseUrl',
    label: 'Password Reset URL',
    description: 'Frontend base URL used in password reset emails.',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['PASSWORD_RESET_BASE_URL'],
    defaultValue: envString(['PASSWORD_RESET_BASE_URL'], 'http://localhost:3000/reset-password'),
  },
  {
    key: 'mail.activationBaseUrl',
    label: 'Account Activation URL',
    description: 'Frontend base URL used in account activation emails.',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['ACTIVATION_BASE_URL'],
    defaultValue: envString(['ACTIVATION_BASE_URL'], 'http://localhost:3000/activate'),
  },
  {
    key: 'mail.emailVerifyBaseUrl',
    label: 'Email Verification URL',
    description: 'Frontend base URL used in email verification emails.',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['EMAIL_VERIFY_BASE_URL'],
    defaultValue: envString(['EMAIL_VERIFY_BASE_URL'], 'http://localhost:3000/email/confirm'),
  },
  { key: 'oauth.launchedProviders', label: 'Launched Providers', description: 'Comma-separated; defaults to google when empty; providers not listed are greyed out as "not yet available" on the login page.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_LAUNCHED_PROVIDERS'], defaultValue: envString(['OAUTH_LAUNCHED_PROVIDERS'], '') },
  { key: 'oauth.webRedirectAllowlist', label: 'Web Redirect Allowlist', description: 'Comma-separated frontend landing page URLs; matched exactly by origin+pathname.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_WEB_REDIRECT_ALLOWLIST'], defaultValue: envString(['OAUTH_WEB_REDIRECT_ALLOWLIST'], '') },
  { key: 'oauth.googleClientId', label: 'Google Client ID', description: 'Google OAuth client id.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_GOOGLE_CLIENT_ID'], defaultValue: envString(['OAUTH_GOOGLE_CLIENT_ID'], '') },
  { key: 'oauth.googleClientSecret', label: 'Google Client Secret', description: 'Google OAuth client secret.', type: 'string', category: 'oauth', editable: true, sensitive: true, allowEmpty: true, envKeys: ['OAUTH_GOOGLE_CLIENT_SECRET'], defaultValue: envString(['OAUTH_GOOGLE_CLIENT_SECRET'], '') },
  { key: 'oauth.googleRedirectUri', label: 'Google Redirect URI', description: 'Backend callback registered with Google, e.g. https://your-domain/api/auth/callback/google.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_GOOGLE_REDIRECT_URI'], defaultValue: envString(['OAUTH_GOOGLE_REDIRECT_URI'], '') },
  { key: 'oauth.githubClientId', label: 'GitHub Client ID', description: 'GitHub OAuth App client id.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_GITHUB_CLIENT_ID'], defaultValue: envString(['OAUTH_GITHUB_CLIENT_ID'], '') },
  { key: 'oauth.githubClientSecret', label: 'GitHub Client Secret', description: 'GitHub OAuth App client secret.', type: 'string', category: 'oauth', editable: true, sensitive: true, allowEmpty: true, envKeys: ['OAUTH_GITHUB_CLIENT_SECRET'], defaultValue: envString(['OAUTH_GITHUB_CLIENT_SECRET'], '') },
  { key: 'oauth.githubRedirectUri', label: 'GitHub Redirect URI', description: 'Backend callback registered with GitHub.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_GITHUB_REDIRECT_URI'], defaultValue: envString(['OAUTH_GITHUB_REDIRECT_URI'], '') },
  { key: 'oauth.appleClientId', label: 'Apple Services ID', description: 'Services ID for Sign in with Apple.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_APPLE_CLIENT_ID'], defaultValue: envString(['OAUTH_APPLE_CLIENT_ID'], '') },
  { key: 'oauth.appleTeamId', label: 'Apple Team ID', description: 'Apple Developer Team ID.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_APPLE_TEAM_ID'], defaultValue: envString(['OAUTH_APPLE_TEAM_ID'], '') },
  { key: 'oauth.appleKeyId', label: 'Apple Key ID', description: 'Apple private key Key ID.', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_APPLE_KEY_ID'], defaultValue: envString(['OAUTH_APPLE_KEY_ID'], '') },
  { key: 'oauth.applePrivateKey', label: 'Apple Private Key (.p8)', description: 'Paste the .p8 content on a single line, using a literal \\n for line breaks (the backend automatically restores them to real line breaks when reading).', type: 'string', category: 'oauth', editable: true, sensitive: true, allowEmpty: true, envKeys: ['OAUTH_APPLE_PRIVATE_KEY'], defaultValue: envString(['OAUTH_APPLE_PRIVATE_KEY'], '') },
  { key: 'oauth.appleRedirectUri', label: 'Apple Redirect URI', description: 'Backend callback registered with Apple (must be https in production).', type: 'string', category: 'oauth', editable: true, allowEmpty: true, envKeys: ['OAUTH_APPLE_REDIRECT_URI'], defaultValue: envString(['OAUTH_APPLE_REDIRECT_URI'], '') },
];

export const PUBLIC_SYSTEM_SETTING_KEYS = new Set([
  'features.chatEnabled',
  'features.libraryEnabled',
  'features.inviteSharingEnabled',
]);

export const EDITABLE_SYSTEM_SETTING_KEYS = new Set(
  SYSTEM_SETTING_DEFINITIONS.filter((item) => item.editable).map((item) => item.key),
);

export function findSystemSettingDefinition(key: string) {
  return SYSTEM_SETTING_DEFINITIONS.find((item) => item.key === key);
}
