import { ipcMain, shell } from 'electron';
import { app } from 'electron';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import log from 'electron-log/main';

/**
 * 资源本地安装协议(本期 Skill / MCP / Agent 全走纯结构化文本):
 *   ~/.amux/skills/<id>/SKILL.md   (skills 落地为单 markdown 文件)
 *   ~/.amux/skills/<id>/manifest.json
 *   ~/.amux/mcp/<id>/manifest.json
 *   ~/.amux/mcp/config.json        (聚合所有 mcp servers,供 chat 主进程读取)
 *   ~/.amux/agents/<id>/manifest.json
 *
 * 复杂 skill bundle(scripts/assets/reference)留作下一期。
 */

type ResourceType = 'SKILL' | 'MCP' | 'AGENT' | 'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE';

const TYPE_TO_DIR: Partial<Record<ResourceType, string>> = {
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
};

const installSchema = z.object({
  type: z.enum(['SKILL', 'MCP', 'AGENT']),
  id: z.string().min(1).max(128),
  payload: z.record(z.unknown()),
});

const uninstallSchema = z.object({
  type: z.enum(['SKILL', 'MCP', 'AGENT']),
  id: z.string().min(1).max(128),
});

const statusSchema = z.object({
  type: z.enum(['SKILL', 'MCP', 'AGENT']),
  id: z.string().min(1).max(128),
});

function rootDir(): string {
  return join(app.getPath('home'), '.amux');
}

function resourceDir(type: ResourceType, id: string): string {
  const sub = TYPE_TO_DIR[type];
  if (!sub) throw new Error(`Unsupported resource type: ${type}`);
  return join(rootDir(), sub, id);
}

async function writeManifest(dir: string, payload: Record<string, unknown>) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
}

async function writeSkillBody(dir: string, payload: Record<string, unknown>) {
  const instructions = (payload as { instructions?: string }).instructions;
  if (typeof instructions === 'string' && instructions.length > 0) {
    await writeFile(join(dir, 'SKILL.md'), instructions, 'utf8');
  }
}

async function readManifest(type: ResourceType, id: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(join(resourceDir(type, id), 'manifest.json'), 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function missingEnvKeys(manifest: Record<string, unknown> | null): string[] {
  const envSchema = manifest?.envSchema;
  if (!envSchema || typeof envSchema !== 'object' || Array.isArray(envSchema)) return [];
  return Object.keys(envSchema as Record<string, unknown>).filter((key) => !process.env[key]);
}

async function rebuildMcpAggregate(): Promise<void> {
  const base = join(rootDir(), 'mcp');
  let entries: string[] = [];
  try {
    entries = await readdir(base);
  } catch {
    return;
  }

  const mcpServers: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry === 'config.json') continue;
    const manifestPath = join(base, entry, 'manifest.json');
    try {
      const raw = await readFile(manifestPath, 'utf8');
      const m = JSON.parse(raw) as {
        serverName?: string;
        transport?: string;
        command?: string;
        args?: string[];
        url?: string;
      };
      const key = m.serverName ?? entry;
      mcpServers[key] = {
        transport: m.transport,
        command: m.command,
        args: m.args,
        url: m.url,
      };
    } catch {
      // skip broken manifest
    }
  }
  await writeFile(
    join(base, 'config.json'),
    JSON.stringify({ mcpServers }, null, 2),
    'utf8',
  );
}

export function registerResourceIpc(): void {
  ipcMain.handle('resource:install', async (_e, raw) => {
    const { type, id, payload } = installSchema.parse(raw);
    const dir = resourceDir(type, id);
    await writeManifest(dir, payload);
    if (type === 'SKILL') await writeSkillBody(dir, payload);
    if (type === 'MCP') await rebuildMcpAggregate();
    log.info(`[resource] installed ${type}:${id} → ${dir}`);
    return { ok: true, path: dir };
  });

  ipcMain.handle('resource:uninstall', async (_e, raw) => {
    const { type, id } = uninstallSchema.parse(raw);
    const dir = resourceDir(type, id);
    await rm(dir, { recursive: true, force: true });
    if (type === 'MCP') await rebuildMcpAggregate();
    log.info(`[resource] uninstalled ${type}:${id}`);
    return { ok: true };
  });

  ipcMain.handle('resource:list-installed', async () => {
    const result: Array<{
      type: ResourceType;
      id: string;
      path: string;
      manifest?: Record<string, unknown>;
    }> = [];
    for (const [t, sub] of Object.entries(TYPE_TO_DIR)) {
      if (!sub) continue;
      const base = join(rootDir(), sub);
      let entries: string[] = [];
      try {
        entries = await readdir(base);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry === 'config.json') continue;
        const dir = join(base, entry);
        try {
          const s = await stat(dir);
          if (!s.isDirectory()) continue;
          let manifest: Record<string, unknown> | undefined;
          try {
            const raw = await readFile(join(dir, 'manifest.json'), 'utf8');
            manifest = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            // 缺少 manifest 时仍列出
          }
          result.push({ type: t as ResourceType, id: entry, path: dir, manifest });
        } catch {
          // skip
        }
      }
    }
    return result;
  });

  ipcMain.handle('resource:status', async (_e, raw) => {
    const { type, id } = statusSchema.parse(raw);
    try {
      const dir = resourceDir(type, id);
      const s = await stat(dir);
      if (!s.isDirectory()) {
        return { status: 'not_installed' as const };
      }
      const manifest = await readManifest(type, id);
      const missingEnv = missingEnvKeys(manifest);
      if (missingEnv.length > 0) {
        return { status: 'missing_env' as const, missingEnv };
      }
      return { status: 'ready' as const, path: dir };
    } catch {
      return { status: 'not_installed' as const };
    }
  });

  ipcMain.handle('resource:open-folder', async (_e, raw) => {
    const parsed = z
      .object({
        type: z.enum(['SKILL', 'MCP', 'AGENT']).optional(),
        id: z.string().optional(),
      })
      .parse(raw ?? {});
    const dir =
      parsed.type && parsed.id
        ? resourceDir(parsed.type, parsed.id)
        : rootDir();
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });
}
