import { BadRequestException } from '@nestjs/common';
import { SystemSettingsRepository } from './system-settings.repository';
import { SystemSettingsService } from './system-settings.service';

type StoredRow = {
  key: string;
  value: string;
  updatedAt: Date;
};

function createService(initialRows: StoredRow[] = []) {
  const rows = new Map<string, StoredRow>(
    initialRows.map((row) => [row.key, row]),
  );
  const prisma = {
    $queryRaw: vi.fn(async () => Array.from(rows.values())),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (values.length === 0) return;
      const [, key, value] = values as [string, string, string];
      rows.set(key, { key, value, updatedAt: new Date('2026-06-16T00:00:00.000Z') });
    }),
  };
  const repository = new SystemSettingsRepository(prisma as never);

  return {
    service: new SystemSettingsService(repository),
    prisma,
    rows,
  };
}

describe('SystemSettingsService', () => {
  it('returns masked sensitive values to admin callers but real values internally', async () => {
    const { service } = createService([
      {
        key: 'payments.stripeSecretKey',
        value: 'sk_live_secret',
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ]);

    const settings = await service.listSettings();
    const stripeSecret = settings.find((item) => item.key === 'payments.stripeSecretKey');

    expect(stripeSecret?.value).toBe('********');
    await expect(service.getString('payments.stripeSecretKey')).resolves.toBe('sk_live_secret');
  });

  it('does not persist masked sensitive placeholders', async () => {
    const { service, rows, prisma } = createService([
      {
        key: 'payments.stripeSecretKey',
        value: 'sk_live_secret',
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ]);

    await service.upsertValues({ 'payments.stripeSecretKey': '********' });

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(rows.get('payments.stripeSecretKey')?.value).toBe('sk_live_secret');
  });

  it('creates the settings table during module initialization', async () => {
    const { service, prisma } = createService();

    await service.onModuleInit();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(String(prisma.$executeRaw.mock.calls[0][0][0])).toContain('CREATE TABLE IF NOT EXISTS');
    expect(String(prisma.$executeRaw.mock.calls[1][0][0])).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
  });

  it('allows clearing optional runtime settings', async () => {
    const { service, rows } = createService([
      {
        key: 'mail.smtpHost',
        value: 'smtp.example.com',
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ]);

    await service.upsertValues({ 'mail.smtpHost': '' });

    expect(rows.get('mail.smtpHost')?.value).toBe('');
  });

  it('persists disabled feature flags and exposes them publicly', async () => {
    const { service, rows } = createService();

    await service.upsertValues({
      'features.chatEnabled': false,
      'features.libraryEnabled': false,
      'features.inviteSharingEnabled': false,
    });

    expect(rows.get('features.chatEnabled')?.value).toBe('false');
    expect(rows.get('features.libraryEnabled')?.value).toBe('false');
    expect(rows.get('features.inviteSharingEnabled')?.value).toBe('false');
    await expect(service.getPublicSettings()).resolves.toMatchObject({
      features: {
        chatEnabled: false,
        libraryEnabled: false,
        inviteSharingEnabled: false,
      },
    });
  });

  it('rejects unknown settings', async () => {
    const { service } = createService();

    await expect(service.upsertValues({ 'security.jwtSecret': 'secret' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.upsertValues({ 'unknown.key': 'value' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
