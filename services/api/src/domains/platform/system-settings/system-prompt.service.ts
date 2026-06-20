import { BadRequestException, Injectable, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_PROMPT_DEFAULTS } from './system-prompt.defaults';

type SystemPromptRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: string;
  content: string;
  variables: unknown;
  status: 'draft' | 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type SystemPromptStatus = 'draft' | 'active' | 'archived';

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
  private tableEnsured = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePromptTable();
  }

  async listPrompts(): Promise<SystemPromptItem[]> {
    await this.ensurePromptTable();
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
    await this.ensurePromptTable();
    const data = this.normalizeInput(input);

    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM system_prompts WHERE key = ${data.key} AND version = ${data.version} LIMIT 1
    `;
    if (existing.length > 0) {
      throw new BadRequestException(`Prompt ${data.key}@${data.version} 已存在`);
    }

    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      INSERT INTO system_prompts (
        id, key, name, description, version, content, variables, status, "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${data.key}, ${data.name}, ${data.description}, ${data.version},
        ${data.content}, ${JSON.stringify(data.variables)}::jsonb, 'draft', now(), now()
      )
      RETURNING id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
    `;
    return this.rowToItem(rows[0]);
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
    await this.ensurePromptTable();
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
      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM system_prompts
        WHERE key = ${current.key} AND version = ${data.version} AND id <> ${id}
        LIMIT 1
      `;
      if (existing.length > 0) {
        throw new BadRequestException(`Prompt ${current.key}@${data.version} 已存在`);
      }
    }

    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      UPDATE system_prompts
      SET name = ${data.name},
          description = ${data.description},
          version = ${data.version},
          content = ${data.content},
          variables = ${JSON.stringify(data.variables)}::jsonb,
          "updatedAt" = now()
      WHERE id = ${id}
      RETURNING id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
    `;
    return this.rowToItem(rows[0]);
  }

  async publish(id: string): Promise<SystemPromptItem> {
    await this.ensurePromptTable();
    const row = await this.findRowById(id);
    if (!row) throw new BadRequestException('Prompt 不存在');

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE system_prompts
        SET status = 'archived', "updatedAt" = now()
        WHERE key = ${row.key} AND status = 'active' AND id <> ${id}
      `;
      return tx.$queryRaw<SystemPromptRow[]>`
        UPDATE system_prompts
        SET status = 'active', "publishedAt" = now(), "updatedAt" = now()
        WHERE id = ${id}
        RETURNING id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      `;
    });

    return this.rowToItem(rows[0]);
  }

  async render(
    key: string,
    variables: Record<string, string | number | boolean | null | undefined> = {},
  ): Promise<RenderedSystemPrompt> {
    await this.ensurePromptTable();
    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      SELECT id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      FROM system_prompts
      WHERE key = ${key} AND status = 'active'
      ORDER BY "publishedAt" DESC NULLS LAST, "updatedAt" DESC
      LIMIT 1
    `;
    const item = rows[0]
      ? this.rowToItem(rows[0])
      : this.defaultPrompt(key);

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
    return this.prisma.$queryRaw<SystemPromptRow[]>`
      SELECT id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      FROM system_prompts
      ORDER BY key ASC, "updatedAt" DESC
    `;
  }

  private async findRowById(id: string): Promise<SystemPromptRow | null> {
    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      SELECT id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      FROM system_prompts
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
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

  private async ensurePromptTable(): Promise<void> {
    if (this.tableEnsured) return;

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "system_prompts" (
        "id" TEXT NOT NULL,
        "key" VARCHAR(160) NOT NULL,
        "name" VARCHAR(160) NOT NULL,
        "description" TEXT,
        "version" VARCHAR(80) NOT NULL,
        "content" TEXT NOT NULL,
        "variables" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "publishedAt" TIMESTAMPTZ(6),
        CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id")
      )
    `;
    await this.prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "system_prompts_key_version_key"
      ON "system_prompts"("key", "version")
    `;
    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "system_prompts_key_status_idx"
      ON "system_prompts"("key", "status")
    `;
    this.tableEnsured = true;
  }
}
