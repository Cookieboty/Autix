import { BadRequestException } from '@nestjs/common';
import { McpTransport } from '../prisma/generated';

type JsonRecord = Record<string, unknown>;

export interface NormalizedMcpConfig {
  rawConfig: JsonRecord;
  serverName: string;
  transport: McpTransport;
  command?: string;
  args: string[];
  url?: string;
  envSchema?: JsonRecord;
  headersSchema?: JsonRecord;
  authSchema?: JsonRecord;
  tools?: unknown;
  capabilities?: unknown;
}

const SECRET_KEY_RE = /(TOKEN|SECRET|KEY|PASSWORD|PASS|CREDENTIAL|AUTH|BEARER)/i;
const SECRET_VALUE_RE = /^(sk-|ghp_|github_pat_|xox[baprs]-|eyJ|[A-Za-z0-9_-]{32,})/;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function inferTransport(server: JsonRecord): McpTransport {
  const raw = asString(server.transport) ?? asString(server.type);
  if (raw === 'stdio' || raw === 'sse' || raw === 'http') return raw;
  if (asString(server.command)) return McpTransport.stdio;
  const url = asString(server.url);
  if (url?.includes('/sse')) return McpTransport.sse;
  if (url) return McpTransport.http;
  throw new BadRequestException('MCP config is missing command or url');
}

function sanitizeValue(key: string, value: unknown) {
  if (typeof value !== 'string') return `\${${key}}`;
  if (value.startsWith('${') && value.endsWith('}')) return value;
  if (!value.trim()) return '';
  if (SECRET_KEY_RE.test(key) || SECRET_VALUE_RE.test(value)) return `\${${key}}`;
  return value;
}

function schemaFromObject(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(
    entries.map(([key, raw]) => [
      key,
      {
        type: 'string',
        required: true,
        description: `Configure ${key}`,
        placeholder: typeof raw === 'string' ? sanitizeValue(key, raw) : `\${${key}}`,
      },
    ]),
  );
}

function sanitizeServer(serverName: string, server: JsonRecord) {
  const copy: JsonRecord = { ...server };
  if (isRecord(copy.env)) {
    copy.env = Object.fromEntries(
      Object.entries(copy.env).map(([key, value]) => [
        key,
        sanitizeValue(key, value),
      ]),
    );
  }
  if (isRecord(copy.headers)) {
    copy.headers = Object.fromEntries(
      Object.entries(copy.headers).map(([key, value]) => [
        key,
        sanitizeValue(key, value),
      ]),
    );
  }
  return { [serverName]: copy };
}

function pickServer(rawConfig: unknown, preferredName?: string): {
  serverName: string;
  server: JsonRecord;
} {
  if (!isRecord(rawConfig)) {
    throw new BadRequestException('MCP config must be a JSON object');
  }

  if (isRecord(rawConfig.mcpServers)) {
    const servers = rawConfig.mcpServers;
    const names = Object.keys(servers);
    if (names.length === 0) {
      throw new BadRequestException('mcpServers cannot be empty');
    }
    const serverName = preferredName && servers[preferredName] ? preferredName : names[0];
    const server = servers[serverName];
    if (!isRecord(server)) {
      throw new BadRequestException(`MCP server ${serverName} must be an object`);
    }
    return { serverName, server };
  }

  const serverName = preferredName ?? asString(rawConfig.name) ?? asString(rawConfig.serverName);
  if (!serverName) {
    throw new BadRequestException('Single-server MCP config requires name/serverName');
  }
  return { serverName, server: rawConfig };
}

export function listMcpServerNames(rawConfig: unknown): string[] {
  if (!isRecord(rawConfig)) return [];
  if (isRecord(rawConfig.mcpServers)) return Object.keys(rawConfig.mcpServers);
  const single = asString(rawConfig.name) ?? asString(rawConfig.serverName);
  return single ? [single] : [];
}

export function normalizeMcpConfig(
  rawConfig: unknown,
  preferredName?: string,
): NormalizedMcpConfig {
  const { serverName, server } = pickServer(rawConfig, preferredName);
  const transport = inferTransport(server);
  const args = Array.isArray(server.args)
    ? server.args.filter((it): it is string => typeof it === 'string')
    : [];
  const envSchema = schemaFromObject(server.env);
  const headersSchema = schemaFromObject(server.headers);

  return {
    rawConfig: { mcpServers: sanitizeServer(serverName, server) },
    serverName,
    transport,
    command: transport === McpTransport.stdio ? asString(server.command) : undefined,
    args,
    url: transport !== McpTransport.stdio ? asString(server.url) : undefined,
    envSchema,
    headersSchema,
    authSchema: envSchema || headersSchema ? { type: 'configured_secrets' } : undefined,
    tools: server.tools,
    capabilities: server.capabilities,
  };
}
