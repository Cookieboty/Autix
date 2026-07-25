import { Injectable } from '@nestjs/common';
import { RuntimeReq, McpTransport } from '../prisma/generated';
import { RuntimeDetectorRepository } from './runtime-detector.repository';

export type DetectionLevel = RuntimeReq | 'SUSPECTED_DESKTOP';

export interface DetectionResult {
  level: DetectionLevel;
  reason: string;
}

export interface McpDetectionInput {
  transport: McpTransport;
  url?: string | null;
  command?: string | null;
  args?: string[];
  envSchema?: unknown;
}

export interface SkillDetectionInput {
  instructions: string;
  frontmatter?: Record<string, unknown>;
}

export interface AgentDetectionInput {
  toolBindings: unknown;
  systemPrompt?: string;
}

const LOCAL_KEYWORDS = [
  'bash',
  'shell',
  'subprocess',
  'spawn(',
  'execSync',
  'child_process',
  'fs.readFile',
  'fs.writeFile',
  'Local file',
  'Local command',
  'Client environment',
  'cli tool',
  'codex cli',
  'gemini cli',
  'desktop only',
  'Desktop only',
];

const LOCAL_URL_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d|172\.(1[6-9]|2\d|3[01])\.)/;

const LOCAL_PATH_RE = /@\.\/|@\/|file:\/\/|~\/|\$\{?HOME\}?|\$\{?USER\}?/;

const ENV_LOCAL_VAR_RE = /\$\{(HOME|USER|PWD|CWD)\}|\$HOME|\$USER|\$PWD|\$CWD/;

@Injectable()
export class RuntimeDetectorService {
  constructor(private readonly repository: RuntimeDetectorRepository) {}

  /**
   * MCP: 规则确定性。stdio / 本地 URL / env 含本地变量 → DESKTOP_ONLY
   */
  detectMcp(mcp: McpDetectionInput): DetectionResult {
    if (mcp.transport === 'stdio') {
      return {
        level: RuntimeReq.DESKTOP_ONLY,
        reason: 'stdio transport must start a local process',
      };
    }

    if (mcp.url && LOCAL_URL_RE.test(mcp.url)) {
      return {
        level: RuntimeReq.DESKTOP_ONLY,
        reason: 'URL points to a local/intranet address',
      };
    }

    if (mcp.envSchema) {
      const envStr = JSON.stringify(mcp.envSchema);
      if (ENV_LOCAL_VAR_RE.test(envStr)) {
        return {
          level: RuntimeReq.DESKTOP_ONLY,
          reason: 'env config depends on local path variables',
        };
      }
    }

    return {
      level: RuntimeReq.CLOUD,
      reason: 'Remote SSE/HTTP transport with no local dependency',
    };
  }

  /**
   * Skill: 多信号融合。返回 CLOUD / DESKTOP_ONLY / SUSPECTED_DESKTOP
   */
  async detectSkill(skill: SkillDetectionInput): Promise<DetectionResult> {
    const fm = (skill.frontmatter ?? {}) as Record<string, unknown>;

    // 硬证据 1: 自带可执行 hooks/scripts(frontmatter 里声明)
    const hooks = fm.hooks as unknown[] | undefined;
    const scripts = fm.scripts as unknown[] | undefined;
    if ((hooks && hooks.length > 0) || (scripts && scripts.length > 0)) {
      return {
        level: RuntimeReq.DESKTOP_ONLY,
        reason: 'Contains hooks/scripts executable code',
      };
    }

    // 硬证据 2: 依赖任意 DESKTOP_ONLY 的 MCP(从 frontmatter.requiredMcps 解析)
    const requiredMcps = (fm.requiredMcps as string[] | undefined) ?? [];
    if (requiredMcps.length > 0) {
      const desktopMcp = await this.repository.findDesktopMcp(requiredMcps);
      if (desktopMcp) {
        return {
          level: RuntimeReq.DESKTOP_ONLY,
          reason: `Depends on desktop-only MCP: ${desktopMcp.title}`,
        };
      }
    }

    // 硬证据 3: 引用本地路径/文件协议
    if (LOCAL_PATH_RE.test(skill.instructions ?? '')) {
      return {
        level: RuntimeReq.DESKTOP_ONLY,
        reason: 'instructions reference a local file path',
      };
    }

    // 软证据: 关键词扫描 → SUSPECTED_DESKTOP
    const lower = (skill.instructions ?? '').toLowerCase();
    const hits = LOCAL_KEYWORDS.filter((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    if (hits.length > 0) {
      return {
        level: 'SUSPECTED_DESKTOP',
        reason: `Matched keyword: ${hits.join(', ')}`,
      };
    }

    return { level: RuntimeReq.CLOUD, reason: 'No client-side dependency found' };
  }

  /**
   * Agent: 依赖传递。toolBindings 引用 DESKTOP_ONLY 的 MCP/Skill 则也是 DESKTOP_ONLY。
   */
  async detectAgent(agent: AgentDetectionInput): Promise<DetectionResult> {
    const tb = agent.toolBindings as
      | { mcps?: string[]; skills?: string[] }
      | undefined;

    const mcpIds = tb?.mcps ?? [];
    const skillIds = tb?.skills ?? [];

    if (mcpIds.length > 0) {
      const desktopMcp = await this.repository.findDesktopMcp(mcpIds);
      if (desktopMcp) {
        return {
          level: RuntimeReq.DESKTOP_ONLY,
          reason: `Depends on desktop-only MCP: ${desktopMcp.title}`,
        };
      }
    }

    if (skillIds.length > 0) {
      const desktopSkill = await this.repository.findDesktopSkill(skillIds);
      if (desktopSkill) {
        return {
          level: RuntimeReq.DESKTOP_ONLY,
          reason: `Depends on desktop-only Skill: ${desktopSkill.title}`,
        };
      }
    }

    return { level: RuntimeReq.CLOUD, reason: 'No client-side dependency found' };
  }
}
