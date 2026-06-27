import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type MailRuntimeConfig = {
  transporter: Transporter | null;
  from: string;
  resetBaseUrl: string;
  activationBaseUrl: string;
  emailVerifyBaseUrl: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  async sendApprovalEmail(to: string, username: string): Promise<void> {
    await this.sendMail({
      to,
      subject: '您的账户已通过审核',
      html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>审核通过</h2>
            <p>您好，${username}：</p>
            <p>您的账户已通过审核，现在可以登录使用了。</p>
            <p style="color: #666; font-size: 13px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
    });
  }

  async sendActivationEmail(to: string, username: string, token: string): Promise<void> {
    const config = await this.getRuntimeConfig();
    if (!config.transporter) return;
    const link = `${config.activationBaseUrl}?token=${encodeURIComponent(token)}`;
    await this.sendMail({
      to,
      subject: '激活您的账户',
      html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>激活账户</h2>
            <p>您好，${username}：</p>
            <p>感谢您的注册，请点击下方按钮完成邮箱验证并激活账户：</p>
            <p><a href="${link}" style="display:inline-block;padding:10px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:4px;">立即激活</a></p>
            <p style="color: #666; font-size: 13px;">此链接 1 小时内有效，且仅可使用一次。</p>
            <p style="color: #666; font-size: 13px;">如非本人操作，请忽略此邮件。</p>
          </div>
        `,
    }, config);
  }

  async sendEmailVerification(to: string, token: string): Promise<void> {
    const config = await this.getRuntimeConfig();
    if (!config.transporter) return;
    const link = `${config.emailVerifyBaseUrl}?token=${encodeURIComponent(token)}`;
    await this.sendMail({
      to,
      subject: '验证您的邮箱',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>邮箱验证</h2>
          <p>您正在绑定新邮箱，请点击下方链接完成验证：</p>
          <p><a href="${link}" style="display:inline-block;padding:10px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:4px;">验证邮箱</a></p>
          <p style="color: #666; font-size: 13px;">此链接 1 小时内有效，且仅可使用一次。</p>
          <p style="color: #666; font-size: 13px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `,
    }, config);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const config = await this.getRuntimeConfig();
    if (!config.transporter) return;
    const link = `${config.resetBaseUrl}?token=${encodeURIComponent(token)}`;
    await this.sendMail({
      to,
      subject: '密码重置',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>密码重置</h2>
          <p>您正在申请重置密码，请点击下方链接完成操作：</p>
          <p><a href="${link}" style="display:inline-block;padding:10px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:4px;">重置密码</a></p>
          <p style="color: #666; font-size: 13px;">此链接 5 分钟内有效，且仅可使用一次。</p>
          <p style="color: #666; font-size: 13px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `,
    }, config);
  }

  private async sendMail(
    options: Omit<SendMailOptions, 'from'>,
    runtimeConfig?: MailRuntimeConfig,
  ): Promise<void> {
    const config = runtimeConfig ?? await this.getRuntimeConfig();
    if (!config.transporter) return;
    try {
      await config.transporter.sendMail({
        from: config.from,
        ...options,
      });
    } catch (err) {
      this.logger.error('Failed to send email', err instanceof Error ? err.stack : String(err));
    }
  }

  private async getRuntimeConfig(): Promise<MailRuntimeConfig> {
    const host = await this.setting('mail.smtpHost');
    const from = await this.setting('mail.smtpFrom') || 'noreply@example.com';
    const resetBaseUrl =
      await this.setting('mail.passwordResetBaseUrl') || 'http://localhost:3000/reset-password';
    const activationBaseUrl =
      await this.setting('mail.activationBaseUrl') || 'http://localhost:3000/activate';
    const emailVerifyBaseUrl =
      await this.setting('mail.emailVerifyBaseUrl') || 'http://localhost:3000/email/confirm';

    if (!host) {
      return { transporter: null, from, resetBaseUrl, activationBaseUrl, emailVerifyBaseUrl };
    }

    const rawPort = Number(await this.setting('mail.smtpPort') || 465);
    const port = Number.isFinite(rawPort) ? rawPort : 465;
    const secure = await this.systemSettingsService
      .getBoolean('mail.smtpSecure')
      .catch(() => process.env.SMTP_SECURE !== 'false');
    const user = await this.setting('mail.smtpUser');
    const pass = await this.setting('mail.smtpPass');

    return {
      from,
      resetBaseUrl,
      activationBaseUrl,
      emailVerifyBaseUrl,
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user || pass ? { user, pass } : undefined,
      }),
    };
  }

  private async setting(key: string) {
    return this.systemSettingsService.getString(key).catch(() => '');
  }
}
