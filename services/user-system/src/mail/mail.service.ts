import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly resetBaseUrl: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    this.from = process.env.SMTP_FROM || 'noreply@example.com';
    this.resetBaseUrl = process.env.PASSWORD_RESET_BASE_URL || 'http://localhost:3002/reset-password';

    if (!host) {
      console.warn('[MailService] SMTP_HOST not configured, emails will be skipped');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendApprovalEmail(to: string, username: string): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: this.from,
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
    } catch (err) {
      console.error('[MailService] Failed to send approval email:', err);
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    if (!this.transporter) return;
    const link = `${this.resetBaseUrl}?token=${encodeURIComponent(token)}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
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
      });
    } catch (err) {
      console.error('[MailService] Failed to send password reset email:', err);
    }
  }
}
