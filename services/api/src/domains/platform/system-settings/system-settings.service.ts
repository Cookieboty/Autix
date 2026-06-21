import { BadRequestException, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  SystemSettingsRepository,
  type SystemSettingRow,
} from './system-settings.repository';
import {
  EDITABLE_SYSTEM_SETTING_KEYS,
  SYSTEM_SETTING_DEFINITIONS,
  PUBLIC_SYSTEM_SETTING_KEYS,
  findSystemSettingDefinition,
  type SystemSettingDefinition,
} from './system-settings.registry';

const MASKED_VALUE = '********';

export type ResolvedSystemSetting = SystemSettingDefinition & {
  value: string;
  source: 'database' | 'environment';
  updatedAt?: Date;
};

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  constructor(private readonly settingsRepository: SystemSettingsRepository) {}

  async onModuleInit(): Promise<void> {
    await this.settingsRepository.ensureTable();
  }

  async listSettings(): Promise<ResolvedSystemSetting[]> {
    const rows = await this.readRows();
    return SYSTEM_SETTING_DEFINITIONS.map((definition) => this.resolveSetting(definition, rows));
  }

  async getPublicSettings() {
    const settings = await this.listSettings();
    const valueOf = (key: string) => settings.find((item) => item.key === key)?.value;
    return {
      features: {
        chatEnabled: this.parseBoolean(valueOf('features.chatEnabled') ?? 'true'),
        modelConfigEnabled: this.parseBoolean(valueOf('features.modelConfigEnabled') ?? 'true'),
        amuxModelImportEnabled: this.parseBoolean(
          valueOf('features.amuxModelImportEnabled') ?? 'true',
        ),
        libraryEnabled: this.parseBoolean(valueOf('features.libraryEnabled') ?? 'true'),
        inviteSharingEnabled: this.parseBoolean(
          valueOf('features.inviteSharingEnabled') ?? 'true',
        ),
      },
      integrations: {
        amuxHost: valueOf('integrations.amuxHost') ?? 'https://api.amux.ai',
        amuxClientId: valueOf('integrations.amuxClientId') ?? 'amux-studio',
      },
      settings: settings
        .filter((item) => PUBLIC_SYSTEM_SETTING_KEYS.has(item.key))
        .map(({ sensitive: _sensitive, ...item }) => item),
    };
  }

  async getBoolean(key: string): Promise<boolean> {
    const setting = await this.getSetting(key, { maskSensitive: false });
    return this.parseBoolean(setting.value);
  }

  async getString(key: string): Promise<string> {
    const setting = await this.getSetting(key, { maskSensitive: false });
    return setting.value;
  }

  async upsertValues(values: Record<string, unknown>) {
    const entries = Object.entries(values);
    const invalidKeys = entries
      .map(([key]) => key)
      .filter((key) => !EDITABLE_SYSTEM_SETTING_KEYS.has(key));
    if (invalidKeys.length > 0) {
      throw new BadRequestException(`不可配置的系统配置项: ${invalidKeys.join(', ')}`);
    }

    const writes: Array<{ key: string; value: string }> = [];
    for (const [key, rawValue] of entries) {
      const definition = findSystemSettingDefinition(key);
      if (!definition) continue;
      if (definition.sensitive && rawValue === MASKED_VALUE) continue;
      const value = this.normalizeValue(definition, rawValue);
      writes.push({ key, value });
    }

    for (const { key, value } of writes) {
      await this.writeRow(key, value);
    }

    return this.listSettings();
  }

  private async getSetting(
    key: string,
    options: { maskSensitive?: boolean } = {},
  ): Promise<ResolvedSystemSetting> {
    const definition = findSystemSettingDefinition(key);
    if (!definition) {
      throw new BadRequestException(`未知系统配置项: ${key}`);
    }
    const rows = await this.readRows();
    return this.resolveSetting(definition, rows, options);
  }

  private resolveSetting(
    definition: SystemSettingDefinition,
    rows: Map<string, SystemSettingRow>,
    options: { maskSensitive?: boolean } = { maskSensitive: true },
  ): ResolvedSystemSetting {
    const row = rows.get(definition.key);
    const value = row?.value ?? definition.defaultValue;
    const shouldMask = options.maskSensitive !== false;
    return {
      ...definition,
      value: shouldMask && definition.sensitive && value ? MASKED_VALUE : value,
      source: row ? 'database' : 'environment',
      updatedAt: row?.updatedAt,
    };
  }

  private normalizeValue(definition: SystemSettingDefinition, rawValue: unknown): string {
    if (definition.type === 'boolean') {
      if (typeof rawValue === 'boolean') return String(rawValue);
      if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return 'true';
        if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return 'false';
      }
      throw new BadRequestException(`${definition.label} 必须是布尔值`);
    }

    if (typeof rawValue !== 'string') {
      throw new BadRequestException(`${definition.label} 必须是字符串`);
    }

    const value = rawValue.trim();
    if (!value && !definition.allowEmpty) {
      throw new BadRequestException(`${definition.label} 不能为空`);
    }
    return value;
  }

  private parseBoolean(value: string): boolean {
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.trim().toLowerCase());
  }

  private async readRows(): Promise<Map<string, SystemSettingRow>> {
    return this.settingsRepository.readRows();
  }

  private async writeRow(key: string, value: string): Promise<void> {
    try {
      await this.settingsRepository.upsertValue(key, value);
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? '系统配置保存失败');
    }
  }
}
