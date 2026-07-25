import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export interface McpRef {
  id: string;
  serverName: string;
  transport: string;
  runtimeRequirement?: string;
}

/**
 * 过滤出 cloud-runnable 的 MCP，为每个创建一个占位 tool。
 * 实际 MCP 调用逻辑待 desktop 桥接后实现；目前仅返回提示信息。
 */
export function createMcpBridgeTools(mcpRefs: McpRef[]) {
  const cloudRunnable = mcpRefs.filter(
    (m) => !m.runtimeRequirement || m.runtimeRequirement !== 'DESKTOP_ONLY',
  );

  return cloudRunnable.map((mcp) =>
    tool(
      async (input) => {
        return `[MCP ${mcp.serverName}] tool call placeholder — parameters: ${JSON.stringify(input.args)}. Actual MCP bridge not yet implemented.`;
      },
      {
        name: `mcp_${mcp.serverName}`,
        description: `Call MCP service: ${mcp.serverName} (${mcp.transport})`,
        schema: z.object({
          method: z.string().describe('MCP method name'),
          args: z.record(z.unknown()).describe('Call parameters'),
        }),
      },
    ),
  );
}
