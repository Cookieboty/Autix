import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type SystemPromptStatus = 'draft' | 'active' | 'archived';

export type SystemPromptRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: string;
  content: string;
  variables: unknown;
  status: SystemPromptStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

type CreateDraftInput = {
  key: string;
  name: string;
  description: string | null;
  version: string;
  content: string;
  variables: string[];
};

type UpdateDraftInput = {
  id: string;
  name: string;
  description: string | null;
  version: string;
  content: string;
  variables: string[];
};

@Injectable()
export class SystemPromptRepository {
  private tableEnsured = false;

  constructor(private readonly prisma: PrismaService) {}

  async ensureTable(): Promise<void> {
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

  findAll(): Promise<SystemPromptRow[]> {
    return this.prisma.$queryRaw<SystemPromptRow[]>`
      SELECT id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      FROM system_prompts
      ORDER BY key ASC, "updatedAt" DESC
    `;
  }

  async findById(id: string): Promise<SystemPromptRow | null> {
    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      SELECT id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      FROM system_prompts
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async existsByKeyVersion(input: {
    key: string;
    version: string;
    excludeId?: string;
  }): Promise<boolean> {
    const rows = input.excludeId
      ? await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM system_prompts
          WHERE key = ${input.key} AND version = ${input.version} AND id <> ${input.excludeId}
          LIMIT 1
        `
      : await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM system_prompts
          WHERE key = ${input.key} AND version = ${input.version}
          LIMIT 1
        `;
    return rows.length > 0;
  }

  async createDraft(input: CreateDraftInput): Promise<SystemPromptRow> {
    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      INSERT INTO system_prompts (
        id, key, name, description, version, content, variables, status, "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${input.key}, ${input.name}, ${input.description}, ${input.version},
        ${input.content}, ${JSON.stringify(input.variables)}::jsonb, 'draft', now(), now()
      )
      RETURNING id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
    `;
    return rows[0];
  }

  async updateDraft(input: UpdateDraftInput): Promise<SystemPromptRow> {
    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      UPDATE system_prompts
      SET name = ${input.name},
          description = ${input.description},
          version = ${input.version},
          content = ${input.content},
          variables = ${JSON.stringify(input.variables)}::jsonb,
          "updatedAt" = now()
      WHERE id = ${input.id}
      RETURNING id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
    `;
    return rows[0];
  }

  async publish(row: Pick<SystemPromptRow, 'id' | 'key'>): Promise<SystemPromptRow> {
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE system_prompts
        SET status = 'archived', "updatedAt" = now()
        WHERE key = ${row.key} AND status = 'active' AND id <> ${row.id}
      `;
      return tx.$queryRaw<SystemPromptRow[]>`
        UPDATE system_prompts
        SET status = 'active', "publishedAt" = now(), "updatedAt" = now()
        WHERE id = ${row.id}
        RETURNING id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      `;
    });

    return rows[0];
  }

  async findActiveByKey(key: string): Promise<SystemPromptRow | null> {
    const rows = await this.prisma.$queryRaw<SystemPromptRow[]>`
      SELECT id, key, name, description, version, content, variables, status, "createdAt", "updatedAt", "publishedAt"
      FROM system_prompts
      WHERE key = ${key} AND status = 'active'
      ORDER BY "publishedAt" DESC NULLS LAST, "updatedAt" DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
