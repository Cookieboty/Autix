import type { Mock } from 'vitest';
import type { SendMailOptions } from 'nodemailer';
import type { SystemSettingsService } from '../system-settings/system-settings.service';
import { I18nService } from '../i18n/i18n.service';
import { MailService } from './mail.service';

function createService() {
  const settings = {
    getString: vi.fn().mockResolvedValue(''),
    getBoolean: vi.fn().mockResolvedValue(true),
  };
  // 用真实 I18nService（加载磁盘词条），断言默认语言 en 的邮件文案。
  const i18n = new I18nService();
  i18n.onModuleInit();
  return new MailService(settings as unknown as SystemSettingsService, i18n);
}

function runtimeConfig(sendMail: Mock) {
  return {
    transporter: { sendMail },
    from: 'security@example.com',
    resetBaseUrl: 'https://example.com/reset',
    activationBaseUrl: 'https://example.com/activate',
    emailVerifyBaseUrl: 'https://example.com/email/confirm',
  };
}

describe('MailService.sendStepUpOtp', () => {
  it('renders the six-digit code and operation details directly in the email', async () => {
    const service = createService();
    const sendMail = vi.fn().mockResolvedValue({});
    Object.defineProperty(service, 'getRuntimeConfig', {
      value: vi.fn().mockResolvedValue(runtimeConfig(sendMail)),
    });

    await service.sendStepUpOtp('user@example.com', '042817', 'delete-account', 5);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const options = sendMail.mock.calls[0]?.[0] as SendMailOptions;
    expect(options).toMatchObject({
      from: 'security@example.com',
      to: 'user@example.com',
      subject: 'Verify account action',
    });
    expect(options.text).toContain('delete account');
    expect(options.text).toContain('Verification code: 042817');
    expect(options.html).toContain('delete account');
    expect(options.html).toContain('>042817</p>');
    expect(options.html).not.toContain('?token=');
  });

  it('propagates SMTP failures so the caller can invalidate the challenge', async () => {
    const service = createService();
    const smtpError = new Error('SMTP unavailable');
    const sendMail = vi.fn().mockRejectedValue(smtpError);
    Object.defineProperty(service, 'getRuntimeConfig', {
      value: vi.fn().mockResolvedValue(runtimeConfig(sendMail)),
    });
    Object.defineProperty(service, 'logger', {
      value: { error: vi.fn() },
    });

    await expect(
      service.sendStepUpOtp('user@example.com', '123456', 'change-email'),
    ).rejects.toBe(smtpError);
  });

  it('rejects when SMTP is not configured instead of reporting a phantom delivery', async () => {
    const service = createService();
    Object.defineProperty(service, 'getRuntimeConfig', {
      value: vi.fn().mockResolvedValue({
        ...runtimeConfig(vi.fn()),
        transporter: null,
      }),
    });

    await expect(
      service.sendStepUpOtp('user@example.com', '123456', 'set-password'),
    ).rejects.toThrow('SMTP transport is not configured');
  });
});
