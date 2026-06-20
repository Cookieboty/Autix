import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type SystemSettingRow = {
  key: string;
  value: string;
  updatedAt: Date;
};

@Injectable()
export class SystemSettingsRepository {
  private tableEnsured = false;

  constructor(private readonly prisma: PrismaService) {}

  async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" TEXT NOT NULL,
        "key" VARCHAR(120) NOT NULL,
        "value" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
      )
    `;
    await this.prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key"
      ON "system_settings"("key")
    `;
    this.tableEnsured = true;
  }

  async readRows(): Promise<Map<string, SystemSettingRow>> {
    try {
      const rows = await this.prisma.$queryRaw<SystemSettingRow[]>`
        SELECT key, value, "updatedAt"
        FROM system_settings
      `;
      return new Map(rows.map((row) => [row.key, row]));
    } catch {
      return new Map();
    }
  }

  async upsertValue(key: string, value: string): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO system_settings (id, key, value, "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${key}, ${value}, now(), now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()
    `;
  }
}
