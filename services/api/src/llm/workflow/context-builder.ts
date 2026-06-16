import type { PrismaService } from '../../prisma/prisma.service';
import type { SearchService } from '../../document/search.service';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { SubAgent } from 'deepagents';
import { createSearchDocumentsTool } from '../deepagents/tools/search-documents.tool';
import { createMcpBridgeTools, type McpRef } from '../deepagents/tools/mcp-bridge.tool';
import { skillAsSubagent, type SkillRecord } from '../deepagents/subagents/skill-as-subagent';
import { agentAsSubagent, type AgentRecord } from '../deepagents/subagents/agent-as-subagent';
import { ResourceType, RuntimeReq } from '../../prisma/generated';

type SkillContextRow = {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
};

type AgentContextRow = {
  id: string;
  title: string;
  description: string | null;
  systemPrompt: string;
  toolBindings: unknown;
};

type McpContextRow = {
  id: string;
  serverName: string;
  transport: McpRef['transport'];
  runtimeRequirement: RuntimeReq;
};

export interface StepContext {
  renderedPrompt: string;
  tools: StructuredToolInterface[];
  subagents: SubAgent[];
}

export interface ContextBuilderDeps {
  prisma: PrismaService;
  searchService: SearchService;
  libraryEnabled?: boolean;
}

/**
 * 唯一上下文注入入口：用户输入 + 上游 artifacts + 资源 + 模板渲染。
 */
export async function buildStepContext(
  deps: ContextBuilderDeps,
  opts: {
    conversationId: string;
    userId: string;
    userInput: string;
    promptTemplate: string;
    inputArtifactKeys: string[];
    runId: string;
    stepToolBindings?: Record<string, unknown> | null;
  },
): Promise<StepContext> {
  const { prisma, searchService, libraryEnabled = true } = deps;
  const { conversationId, userId, promptTemplate, inputArtifactKeys, runId } = opts;

  // 1. 获取上游 step artifacts
  const upstreamArtifacts: Record<string, string> = {};
  if (inputArtifactKeys.length > 0) {
    const artifacts = await prisma.workflow_step_artifacts.findMany({
      where: { runId, stepKey: { in: inputArtifactKeys } },
      orderBy: { version: 'desc' },
      distinct: ['stepKey'],
    });
    for (const a of artifacts) {
      upstreamArtifacts[a.stepKey] = a.content;
    }
  }

  // 2. 渲染 prompt template
  let rendered = promptTemplate
    .replace(/\{\{userInput\}\}/g, opts.userInput);

  for (const [key, content] of Object.entries(upstreamArtifacts)) {
    rendered = rendered.replace(new RegExp(`\\{\\{artifact:${key}\\}\\}`, 'g'), content);
  }

  // 清理未替换的 artifact 占位符
  rendered = rendered.replace(/\{\{artifact:\w+\}\}/g, '（该阶段产物不可用）');

  // 3. 获取会话激活的资源
  const links = await prisma.conversation_resources.findMany({
    where: { conversationId },
    orderBy: { activatedAt: 'asc' },
  });

  const skillIds = links.filter((l) => l.resourceType === ResourceType.SKILL).map((l) => l.resourceId);
  const agentIds = links.filter((l) => l.resourceType === ResourceType.AGENT).map((l) => l.resourceId);
  const mcpIds = links.filter((l) => l.resourceType === ResourceType.MCP).map((l) => l.resourceId);

  const [skills, agents, mcps]: [
    SkillContextRow[],
    AgentContextRow[],
    McpContextRow[],
  ] = await Promise.all([
    skillIds.length > 0
      ? prisma.skills.findMany({ where: { id: { in: skillIds } }, select: { id: true, title: true, description: true, instructions: true } })
      : Promise.resolve([] as SkillContextRow[]),
    agentIds.length > 0
      ? prisma.agents.findMany({ where: { id: { in: agentIds }, executionMode: 'single' }, select: { id: true, title: true, description: true, systemPrompt: true, toolBindings: true } })
      : Promise.resolve([] as AgentContextRow[]),
    mcpIds.length > 0
      ? prisma.mcp_servers.findMany({ where: { id: { in: mcpIds } }, select: { id: true, serverName: true, transport: true, runtimeRequirement: true } })
      : Promise.resolve([] as McpContextRow[]),
  ]);

  // 4. 组装 tools
  const tools: StructuredToolInterface[] = [];
  if (libraryEnabled) {
    tools.push(createSearchDocumentsTool(searchService, userId));
  }

  const cloudMcps: McpRef[] = mcps
    .filter((m) => m.runtimeRequirement !== RuntimeReq.DESKTOP_ONLY)
    .map((m) => ({ id: m.id, serverName: m.serverName, transport: m.transport }));
  tools.push(...createMcpBridgeTools(cloudMcps));

  // 5. 组装 subagents
  const subagents: SubAgent[] = [
    ...skills.map((s) => skillAsSubagent(s as SkillRecord)),
    ...agents.map((a) => agentAsSubagent(a as AgentRecord)),
  ];

  // 6. 追加资源信息到 prompt
  const resourceSections: string[] = [];
  for (const s of skills) {
    resourceSections.push(`## 可用 Skill: ${s.title}\n${s.instructions}`);
  }
  for (const a of agents) {
    resourceSections.push(`## 可用 Agent: ${a.title}\n${a.systemPrompt}`);
  }
  if (resourceSections.length > 0) {
    rendered += `\n\n### 会话已激活资源\n\n${resourceSections.join('\n\n')}`;
  }

  return { renderedPrompt: rendered, tools, subagents };
}
