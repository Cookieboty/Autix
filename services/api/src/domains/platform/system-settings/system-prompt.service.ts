import { BadRequestException, Injectable, type OnModuleInit } from '@nestjs/common';
import { SYSTEM_PROMPT_DEFAULTS } from './system-prompt.defaults';
import {
  SystemPromptRepository,
  type SystemPromptRow,
  type SystemPromptStatus,
} from './system-prompt.repository';

export type { SystemPromptStatus } from './system-prompt.repository';

export type SystemPromptItem = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  version: string;
  content: string;
  variables: string[];
  status: SystemPromptStatus;
  source: 'database' | 'default';
  createdAt?: Date;
  updatedAt?: Date;
  publishedAt?: Date | null;
};

export type RenderedSystemPrompt = {
  key: string;
  name: string;
  version: string;
  content: string;
  variables: string[];
  source: 'database' | 'default';
};

@Injectable()
export class SystemPromptService implements OnModuleInit {
  constructor(private readonly promptsRepository: SystemPromptRepository) {}

  async onModuleInit(): Promise<void> {
    await this.promptsRepository.ensureTable();
  }

  async listPrompts(): Promise<SystemPromptItem[]> {
    await this.promptsRepository.ensureTable();
    const rows = await this.readRows();
    const items = rows.map((row) => this.rowToItem(row));
    const activeDatabaseKeys = new Set(
      items
        .filter((item) => item.status === 'active')
        .map((item) => item.key),
    );
    const fallbackItems = SYSTEM_PROMPT_DEFAULTS
      .filter((definition) => !activeDatabaseKeys.has(definition.key))
      .map((definition) => ({
        id: `default:${definition.key}`,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        version: definition.version,
        content: definition.content,
        variables: [...definition.variables],
        status: 'active' as const,
        source: 'default' as const,
      }));

    return [...items, ...fallbackItems].sort((a, b) => {
      const byKey = a.key.localeCompare(b.key);
      if (byKey !== 0) return byKey;
      return b.version.localeCompare(a.version);
    });
  }

  async createDraft(input: {
    key: string;
    name: string;
    description?: string | null;
    version: string;
    content: string;
    variables?: string[];
  }): Promise<SystemPromptItem> {
    await this.promptsRepository.ensureTable();
    const data = this.normalizeInput(input);

    const exists = await this.promptsRepository.existsByKeyVersion({
      key: data.key,
      version: data.version,
    });
    if (exists) {
      throw new BadRequestException(`Prompt ${data.key}@${data.version} 已存在`);
    }

    const row = await this.promptsRepository.createDraft(data);
    return this.rowToItem(row);
  }

  async updateDraft(
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      version: string;
      content: string;
      variables: string[];
    }>,
  ): Promise<SystemPromptItem> {
    await this.promptsRepository.ensureTable();
    const current = await this.findRowById(id);
    if (!current) throw new BadRequestException('Prompt 不存在');
    if (current.status !== 'draft') throw new BadRequestException('只有 draft 版本可以编辑');

    const data = this.normalizeInput({
      key: current.key,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      version: input.version ?? current.version,
      content: input.content ?? current.content,
      variables: input.variables ?? this.normalizeVariables(current.variables),
    });

    if (data.version !== current.version) {
      const exists = await this.promptsRepository.existsByKeyVersion({
        key: current.key,
        version: data.version,
        excludeId: id,
      });
      if (exists) {
        throw new BadRequestException(`Prompt ${current.key}@${data.version} 已存在`);
      }
    }

    const row = await this.promptsRepository.updateDraft({ id, ...data });
    return this.rowToItem(row);
  }

  async publish(id: string): Promise<SystemPromptItem> {
    await this.promptsRepository.ensureTable();
    const row = await this.findRowById(id);
    if (!row) throw new BadRequestException('Prompt 不存在');

    const published = await this.promptsRepository.publish(row);
    return this.rowToItem(published);
  }

  async render(
    key: string,
    variables: Record<string, string | number | boolean | null | undefined> = {},
  ): Promise<RenderedSystemPrompt> {
    await this.promptsRepository.ensureTable();
    const row = await this.promptsRepository.findActiveByKey(key);
    const item = row ? this.rowToItem(row) : this.defaultPrompt(key);

    return {
      key: item.key,
      name: item.name,
      version: item.version,
      variables: item.variables,
      source: item.source,
      content: this.renderTemplate(item.content, variables),
    };
  }

  private defaultPrompt(key: string): SystemPromptItem {
    const definition = SYSTEM_PROMPT_DEFAULTS.find((item) => item.key === key);
    if (!definition) throw new BadRequestException(`未知系统 Prompt: ${key}`);
    return {
      id: `default:${definition.key}`,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      version: definition.version,
      content: definition.content,
      variables: [...definition.variables],
      status: 'active',
      source: 'default',
    };
  }

  private async readRows(): Promise<SystemPromptRow[]> {
    return this.promptsRepository.findAll();
  }

  private async findRowById(id: string): Promise<SystemPromptRow | null> {
    return this.promptsRepository.findById(id);
  }

  private rowToItem(row: SystemPromptRow): SystemPromptItem {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      version: row.version,
      content: row.content,
      variables: this.normalizeVariables(row.variables),
      status: row.status,
      source: 'database',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    };
  }

  private normalizeInput(input: {
    key: string;
    name: string;
    description?: string | null;
    version: string;
    content: string;
    variables?: string[];
  }) {
    const key = input.key.trim();
    const name = input.name.trim();
    const version = input.version.trim();
    const content = input.content.trim();
    if (!key) throw new BadRequestException('Prompt key 不能为空');
    if (!name) throw new BadRequestException('Prompt 名称不能为空');
    if (!version) throw new BadRequestException('Prompt 版本不能为空');
    if (!content) throw new BadRequestException('Prompt 内容不能为空');
    return {
      key,
      name,
      version,
      content,
      description: input.description?.trim() || null,
      variables: this.normalizeVariables(input.variables),
    };
  }

  private normalizeVariables(value: unknown): string[] {
    if (Array.isArray(value)) {
      return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
    }
    return [];
  }

  private renderTemplate(
    content: string,
    variables: Record<string, string | number | boolean | null | undefined>,
  ): string {
    return content.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, name: string) => {
      const value = variables[name];
      return value == null ? match : String(value);
    });
  }
}
