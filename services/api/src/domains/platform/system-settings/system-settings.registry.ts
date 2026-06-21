import { readBooleanEnv } from '../common/env-flags';

export type SystemSettingType = 'boolean' | 'string';
export type SystemSettingCategory =
  | 'features'
  | 'integration'
  | 'payments'
  | 'storage'
  | 'mail';

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
    label: 'Chat 功能',
    description: '控制 Chat 会话、竞技场、会话资源激活和首页工作台入口。',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_CHAT', 'CHAT_ENABLED'],
    defaultValue: envBoolean(['ENABLE_CHAT', 'CHAT_ENABLED'], true),
  },
  {
    key: 'features.modelConfigEnabled',
    label: '模型配置功能',
    description: '控制用户私有模型配置页、私有模型导入和私有模型使用。',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_MODEL_CONFIG', 'MODEL_CONFIG_ENABLED'],
    defaultValue: envBoolean(['ENABLE_MODEL_CONFIG', 'MODEL_CONFIG_ENABLED'], true),
  },
  {
    key: 'features.amuxModelImportEnabled',
    label: '从 Amux 导入模型',
    description: '控制 /models 页面中的 Amux 模型导入入口及后端代理接口。',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_AMUX_MODEL_IMPORT', 'AMUX_MODEL_IMPORT_ENABLED'],
    defaultValue: envBoolean(['ENABLE_AMUX_MODEL_IMPORT', 'AMUX_MODEL_IMPORT_ENABLED'], true),
  },
  {
    key: 'features.libraryEnabled',
    label: '资料库功能',
    description: '控制资料库页面、文档上传处理、文档检索和相关入口。',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_LIBRARY', 'LIBRARY_ENABLED'],
    defaultValue: envBoolean(['ENABLE_LIBRARY', 'LIBRARY_ENABLED'], true),
  },
  {
    key: 'features.inviteSharingEnabled',
    label: '邀请分享功能',
    description: '控制邀请链接、邀请码登记和邀请奖励结算。',
    type: 'boolean',
    category: 'features',
    editable: true,
    envKeys: ['ENABLE_INVITE_SHARING', 'INVITE_SHARING_ENABLED'],
    defaultValue: envBoolean(['ENABLE_INVITE_SHARING', 'INVITE_SHARING_ENABLED'], true),
  },
  {
    key: 'integrations.amuxHost',
    label: 'Amux API 地址',
    description: 'Amux 授权、导入模型和相关代理默认使用的 API 地址。',
    type: 'string',
    category: 'integration',
    editable: true,
    envKeys: ['NEXT_PUBLIC_AMUX_HOST', 'AMUX_HOST'],
    defaultValue: envString(['NEXT_PUBLIC_AMUX_HOST', 'AMUX_HOST'], 'https://api.amux.ai'),
  },
  {
    key: 'integrations.amuxClientId',
    label: 'Amux Client ID',
    description: 'Amux OAuth 授权使用的客户端标识。',
    type: 'string',
    category: 'integration',
    editable: true,
    envKeys: ['NEXT_PUBLIC_AMUX_CLIENT_ID', 'AMUX_CLIENT_ID'],
    defaultValue: envString(['NEXT_PUBLIC_AMUX_CLIENT_ID', 'AMUX_CLIENT_ID'], 'amux-studio'),
  },
  {
    key: 'payments.webAppUrl',
    label: 'Web 应用地址',
    description: '支付成功、取消跳转等场景使用的前端基础地址。',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['WEB_APP_URL'],
    defaultValue: envString(['WEB_APP_URL'], 'http://localhost:3100'),
  },
  {
    key: 'payments.stripeSecretKey',
    label: 'Stripe Secret Key',
    description: 'Stripe API 调用密钥，保存后不会在后台明文回显。',
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
    label: 'Stripe Test 模式',
    description: '开启后要求使用 Stripe sandbox/test API key，避免开发环境误用 live key。',
    type: 'boolean',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_TEST_MODE'],
    defaultValue: envBoolean(['STRIPE_TEST_MODE'], false),
  },
  {
    key: 'payments.stripeWebhookSecret',
    label: 'Stripe Webhook Secret',
    description: 'Stripe Webhook 签名校验密钥，保存后不会在后台明文回显。',
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
    label: 'Stripe 结算币种',
    description: '支付订单提交到 Stripe 时使用的币种，例如 USD、JPY。',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_CURRENCY'],
    defaultValue: envString(['STRIPE_CURRENCY'], 'USD'),
  },
  {
    key: 'payments.stripeApiBase',
    label: 'Stripe API 地址',
    description: 'Stripe API 基础地址，默认使用官方 API。',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_API_BASE'],
    defaultValue: envString(['STRIPE_API_BASE'], 'https://api.stripe.com'),
  },
  {
    key: 'payments.stripeSuccessUrl',
    label: '支付成功跳转',
    description: 'Stripe Checkout 支付成功后的跳转地址。',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_SUCCESS_URL'],
    defaultValue: envString(
      ['STRIPE_SUCCESS_URL'],
      `${envString(['WEB_APP_URL'], 'http://localhost:3100')}/membership/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    ),
  },
  {
    key: 'payments.stripeCancelUrl',
    label: '支付取消跳转',
    description: 'Stripe Checkout 用户取消支付后的跳转地址。',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_CANCEL_URL'],
    defaultValue: envString(
      ['STRIPE_CANCEL_URL'],
      `${envString(['WEB_APP_URL'], 'http://localhost:3100')}/membership/orders?checkout=cancelled`,
    ),
  },
  {
    key: 'payments.stripeWebhookToleranceSeconds',
    label: 'Webhook 时间容忍秒数',
    description: 'Stripe Webhook 签名时间戳允许的最大偏差秒数。',
    type: 'string',
    category: 'payments',
    editable: true,
    envKeys: ['STRIPE_WEBHOOK_TOLERANCE_SECONDS'],
    defaultValue: envString(['STRIPE_WEBHOOK_TOLERANCE_SECONDS'], '300'),
  },
  {
    key: 'storage.r2BucketName',
    label: 'R2 Bucket',
    description: 'Cloudflare R2 Bucket 名称。',
    type: 'string',
    category: 'storage',
    editable: true,
    allowEmpty: true,
    envKeys: ['R2_BUCKET_NAME'],
    defaultValue: envString(['R2_BUCKET_NAME'], ''),
  },
  {
    key: 'storage.r2PublicUrl',
    label: 'R2 公开访问域名',
    description: '对象上传后拼接生成公开访问地址的域名。',
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
    description: 'Cloudflare R2 S3 兼容 API 地址。',
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
    description: 'Cloudflare R2 Access Key ID，保存后不会在后台明文回显。',
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
    description: 'Cloudflare R2 Secret Access Key，保存后不会在后台明文回显。',
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
    description: '邮件服务主机，留空时系统会跳过邮件发送。',
    type: 'string',
    category: 'mail',
    editable: true,
    allowEmpty: true,
    envKeys: ['SMTP_HOST'],
    defaultValue: envString(['SMTP_HOST'], ''),
  },
  {
    key: 'mail.smtpPort',
    label: 'SMTP 端口',
    description: '邮件服务端口。',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['SMTP_PORT'],
    defaultValue: envString(['SMTP_PORT'], '465'),
  },
  {
    key: 'mail.smtpSecure',
    label: 'SMTP SSL/TLS',
    description: '控制 SMTP 连接是否启用 SSL/TLS。',
    type: 'boolean',
    category: 'mail',
    editable: true,
    envKeys: ['SMTP_SECURE'],
    defaultValue: envBoolean(['SMTP_SECURE'], true),
  },
  {
    key: 'mail.smtpUser',
    label: 'SMTP 用户名',
    description: '邮件服务登录用户名。',
    type: 'string',
    category: 'mail',
    editable: true,
    allowEmpty: true,
    envKeys: ['SMTP_USER'],
    defaultValue: envString(['SMTP_USER'], ''),
  },
  {
    key: 'mail.smtpPass',
    label: 'SMTP 密码',
    description: '邮件服务登录密码，保存后不会在后台明文回显。',
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
    label: '发件人',
    description: '系统邮件显示的发件人地址。',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['SMTP_FROM'],
    defaultValue: envString(['SMTP_FROM'], 'Autix <noreply@example.com>'),
  },
  {
    key: 'mail.passwordResetBaseUrl',
    label: '密码重置地址',
    description: '密码重置邮件中使用的前端基础地址。',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['PASSWORD_RESET_BASE_URL'],
    defaultValue: envString(['PASSWORD_RESET_BASE_URL'], 'http://localhost:3000/reset-password'),
  },
  {
    key: 'mail.activationBaseUrl',
    label: '账号激活地址',
    description: '账号激活邮件中使用的前端基础地址。',
    type: 'string',
    category: 'mail',
    editable: true,
    envKeys: ['ACTIVATION_BASE_URL'],
    defaultValue: envString(['ACTIVATION_BASE_URL'], 'http://localhost:3000/activate'),
  },
];

export const PUBLIC_SYSTEM_SETTING_KEYS = new Set([
  'features.chatEnabled',
  'features.modelConfigEnabled',
  'features.amuxModelImportEnabled',
  'features.libraryEnabled',
  'features.inviteSharingEnabled',
  'integrations.amuxHost',
  'integrations.amuxClientId',
]);

export const EDITABLE_SYSTEM_SETTING_KEYS = new Set(
  SYSTEM_SETTING_DEFINITIONS.filter((item) => item.editable).map((item) => item.key),
);

export function findSystemSettingDefinition(key: string) {
  return SYSTEM_SETTING_DEFINITIONS.find((item) => item.key === key);
}
