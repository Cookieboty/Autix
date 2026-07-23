/**
 * analysis-tools.ts
 *
 * 需求分析工具集：用于 ReAct 子图中的工具调用
 * 当前为 Mock 实现，实际项目中应该连接真实的数据源
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

interface MockRequirement {
  title: string;
  description: string;
  status: string;
  priority: string;
  dependencies: string[];
  createdAt: string;
  assignee: string;
}

/**
 * 工具 1：需求查询
 * 根据需求编号（REQ-XXX）查询需求详情
 */
export const searchRequirementTool = tool(
  async ({ reqId }: { reqId: string }) => {
    // Mock 实现：实际项目中应该查询数据库
    // 这里根据需求编号返回预设的需求详情
    const mockRequirements: Record<string, MockRequirement> = {
      'REQ-20240315-001': {
        title: 'Online survey system',
        description: 'Develop a survey system supporting multiple question types, including single-choice, multiple-choice, and fill-in-the-blank, able to collect and aggregate data in real time',
        status: 'In progress',
        priority: 'High',
        dependencies: ['User management module', 'Data analytics module'],
        createdAt: '2024-03-15',
        assignee: 'John',
      },
      'REQ-20240310-005': {
        title: 'OAuth authentication system',
        description: 'Implement a third-party authentication system based on OAuth 2.0, supporting login via platforms such as Google and GitHub',
        status: 'Completed',
        priority: 'High',
        dependencies: ['User management module'],
        createdAt: '2024-03-10',
        assignee: 'Jane',
      },
      'REQ-20240415-002': {
        title: 'Mobile responsive adaptation',
        description: 'Rework the existing web app into a responsive design, supporting access from mobile, tablet, and other devices',
        status: 'Planned',
        priority: 'Medium',
        dependencies: ['Frontend refactor'],
        createdAt: '2024-04-15',
        assignee: 'Alex',
      },
    };

    const requirement = mockRequirements[reqId];

    if (!requirement) {
      return `Requirement ${reqId} not found. Please verify the requirement ID is correct.`;
    }

    return `Requirement ${reqId} details:
Title: ${requirement.title}
Description: ${requirement.description}
Status: ${requirement.status}
Priority: ${requirement.priority}
Dependencies: ${requirement.dependencies.join(', ')}
Created: ${requirement.createdAt}
Assignee: ${requirement.assignee}`;
  },
  {
    name: 'search_requirement',
    description: 'Query requirement details by requirement ID. Parameter reqId format: REQ-YYYYMMDD-NNN (e.g. REQ-20240315-001)',
    schema: z.object({
      reqId: z.string().describe('Requirement ID, in the format REQ-YYYYMMDD-NNN, e.g. REQ-20240315-001'),
    }),
  }
);

/**
 * 工具 2：冲突检测
 * 根据需求编号和描述检测与现有需求的冲突
 */
export const checkConflictsTool = tool(
  async ({ reqId, description }: { reqId: string; description: string }) => {
    // Mock 实现：实际项目中应该调用冲突检测服务
    // 这里根据关键词进行简单的冲突判断

    const descLower = description.toLowerCase();

    // 检测认证相关的冲突
    if ((descLower.includes('login') || descLower.includes('authentication') || descLower.includes('auth')) &&
        (descLower.includes('jwt') || descLower.includes('session') || descLower.includes('token'))) {
      return `Potential conflict detected:
- Functional overlap with requirement REQ-20240310-005 (OAuth authentication system)
- Conflict type: authentication scheme conflict
- Details: this requirement involves user authentication, but the system already has an OAuth authentication scheme. Suggestions:
  1. Unify the authentication scheme to avoid maintaining two systems
  2. If multiple authentication methods are needed, adopt an authentication strategy pattern
  3. Clarify the use cases and priority of the two authentication methods
- Recommended solution: coordinate with the owner of REQ-20240310-005 to define a unified authentication architecture`;
    }

    // 检测数据统计相关的冲突
    if (descLower.includes('statistics') || descLower.includes('report') || descLower.includes('analytics')) {
      return `Potential dependency detected:
- The requirement may depend on the existing data analytics module
- Suggestion: confirm interface compatibility with the data analytics module
- Note: if real-time statistics are needed, evaluate the performance impact`;
    }

    // 检测移动端相关的冲突
    if (descLower.includes('mobile') || descLower.includes('responsive')) {
      return `Potential dependency detected:
- Dependency relationship with requirement REQ-20240415-002 (mobile responsive adaptation)
- Suggestion: implement this requirement after the responsive rework is complete
- Note: consider mobile user experience and performance optimization`;
    }

    // 未检测到明显冲突
    return `No obvious conflicts detected. Requirement ${reqId} can proceed normally.
Suggestions:
1. Re-confirm interface compatibility with related modules before implementation
2. Pay attention to performance and security requirements
3. Communicate and coordinate with related teams in a timely manner`;
  },
  {
    name: 'check_conflicts',
    description: 'Detect whether a requirement conflicts with existing requirements. Requires a requirement ID and functional description, and returns conflict-detection results and resolution suggestions',
    schema: z.object({
      reqId: z.string().describe('The requirement ID to check, in the format REQ-YYYYMMDD-NNN'),
      description: z.string().describe('The functional description of the requirement, used to analyze potential conflicts'),
    }),
  }
);

/**
 * 导出工具数组，供 ReAct 子图使用
 */
export const analysisTools = [searchRequirementTool, checkConflictsTool];
