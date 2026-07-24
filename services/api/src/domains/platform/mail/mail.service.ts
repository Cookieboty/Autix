import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import * as nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import type { StepUpPurpose } from '@autix/domain';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { I18nService } from '../i18n/i18n.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type MailRuntimeConfig = {
  transporter: Transporter | null;
  from: string;
  resetBaseUrl: string;
  activationBaseUrl: string;
  emailVerifyBaseUrl: string;
};

const BTN =
  'display:inline-block;padding:10px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:4px;';
const MUTED = 'color: #666; font-size: 13px;';

@Injectable()
export class MailService {
  private readonly logger = new AppLogger(MailService.name);

  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly i18n: I18nService,
  ) {}

  /** 收件人语言由调用方按用户偏好传入；缺省回退 DEFAULT_LANGUAGE。邮件文案统一走 i18n 词条。 */
  private t(lang: string, key: string, args?: Record<string, unknown>): string {
    return this.i18n.t(lang, key, args);
  }

  /** 统一的邮件外层容器，各邮件只拼内部段落，保证结构 DRY。 */
  private wrap(inner: string): string {
    return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">${inner}
        </div>
      `;
  }

  async sendApprovalEmail(
    to: string,
    username: string,
    lang: string = DEFAULT_LANGUAGE,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: this.t(lang, 'mail.approval.subject'),
      html: this.wrap(`
          <h2>${this.t(lang, 'mail.approval.heading')}</h2>
          <p>${this.t(lang, 'mail.greeting', { username })}</p>
          <p>${this.t(lang, 'mail.approval.body')}</p>
          <p style="${MUTED}">${this.t(lang, 'mail.footer_auto')}</p>`),
    });
  }

  async sendActivationEmail(
    to: string,
    username: string,
    token: string,
    lang: string = DEFAULT_LANGUAGE,
  ): Promise<void> {
    const config = await this.getRuntimeConfig();
    if (!config.transporter) return;
    const link = `${config.activationBaseUrl}?token=${encodeURIComponent(token)}`;
    await this.sendMail({
      to,
      subject: this.t(lang, 'mail.activation.subject'),
      html: this.wrap(`
          <h2>${this.t(lang, 'mail.activation.heading')}</h2>
          <p>${this.t(lang, 'mail.greeting', { username })}</p>
          <p>${this.t(lang, 'mail.activation.body')}</p>
          <p><a href="${link}" style="${BTN}">${this.t(lang, 'mail.activation.button')}</a></p>
          <p style="${MUTED}">${this.t(lang, 'mail.link_valid_1h')}</p>
          <p style="${MUTED}">${this.t(lang, 'mail.footer_ignore')}</p>`),
    }, config);
  }

  async sendEmailVerification(
    to: string,
    token: string,
    lang: string = DEFAULT_LANGUAGE,
  ): Promise<void> {
    const config = await this.getRuntimeConfig();
    if (!config.transporter) return;
    const link = `${config.emailVerifyBaseUrl}?token=${encodeURIComponent(token)}`;
    await this.sendMail({
      to,
      subject: this.t(lang, 'mail.email_verify.subject'),
      html: this.wrap(`
          <h2>${this.t(lang, 'mail.email_verify.heading')}</h2>
          <p>${this.t(lang, 'mail.email_verify.body')}</p>
          <p><a href="${link}" style="${BTN}">${this.t(lang, 'mail.email_verify.button')}</a></p>
          <p style="${MUTED}">${this.t(lang, 'mail.link_valid_1h')}</p>
          <p style="${MUTED}">${this.t(lang, 'mail.footer_ignore')}</p>`),
    }, config);
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    lang: string = DEFAULT_LANGUAGE,
  ): Promise<void> {
    const config = await this.getRuntimeConfig();
    if (!config.transporter) return;
    const link = `${config.resetBaseUrl}?token=${encodeURIComponent(token)}`;
    await this.sendMail({
      to,
      subject: this.t(lang, 'mail.password_reset.subject'),
      html: this.wrap(`
          <h2>${this.t(lang, 'mail.password_reset.heading')}</h2>
          <p>${this.t(lang, 'mail.password_reset.body')}</p>
          <p><a href="${link}" style="${BTN}">${this.t(lang, 'mail.password_reset.button')}</a></p>
          <p style="${MUTED}">${this.t(lang, 'mail.link_valid_5m')}</p>
          <p style="${MUTED}">${this.t(lang, 'mail.footer_ignore')}</p>`),
    }, config);
  }

  async sendStepUpOtp(
    to: string,
    code: string,
    purpose: StepUpPurpose,
    expiresInMinutes = 5,
    lang: string = DEFAULT_LANGUAGE,
  ): Promise<void> {
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Step-up OTP must be exactly 6 digits');
    }

    const config = await this.getRuntimeConfig();
    if (!config.transporter) {
      throw new Error('SMTP transport is not configured');
    }

    const purpose_label = this.t(lang, `mail.step_up.purpose.${purpose.replace(/-/g, '_')}`);
    await this.sendMail({
      to,
      subject: this.t(lang, 'mail.step_up.subject'),
      text: [
        this.t(lang, 'mail.step_up.text_intro', { purpose: purpose_label }),
        this.t(lang, 'mail.step_up.code_label', { code }),
        this.t(lang, 'mail.step_up.expiry', { minutes: expiresInMinutes }),
        this.t(lang, 'mail.footer_ignore'),
      ].join('\n'),
      html: this.wrap(`
          <h2>${this.t(lang, 'mail.step_up.heading')}</h2>
          <p>${this.t(lang, 'mail.step_up.body', { purpose: purpose_label })}</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px;">${code}</p>
          <p style="${MUTED}">${this.t(lang, 'mail.step_up.expiry', { minutes: expiresInMinutes })}</p>
          <p style="${MUTED}">${this.t(lang, 'mail.footer_ignore')}</p>`),
    }, config, true);
  }

  private async sendMail(
    options: Omit<SendMailOptions, 'from'>,
    runtimeConfig?: MailRuntimeConfig,
    propagateFailure = false,
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
      if (propagateFailure) throw err;
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
