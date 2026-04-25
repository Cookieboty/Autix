/**
 * analysis-tools.ts
 * 
 * 需求分析工具集：用于 ReAct 子图中的工具调用
 * 当前为 Mock 实现，实际项目中应该连接真实的数据源
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 工具 1：需求查询
 * 根据需求编号（REQ-XXX）查询需求详情
 */
export const searchRequirementTool = tool(
  async ({ reqId }: { reqId: string }) => {
    // Mock 实现：实际项目中应该查询数据库
    // 这里根据需求编号返回预设的需求详情
    const mockRequirements: Record<string, any> = {
      'REQ-20240315-001': {
        title: '在线问卷调查系统',
        description: '开发一个支持多种题型的问卷系统，包括单选、多选、填空等，能够实时收集和统计数据',
        status: '进行中',
        priority: '高',
        dependencies: ['用户管理模块', '数据统计模块'],
        createdAt: '2024-03-15',
        assignee: '张三',
      },
      'REQ-20240310-005': {
        title: 'OAuth 认证系统',
        description: '实现基于 OAuth 2.0 的第三方认证系统，支持 Google、GitHub 等平台登录',
        status: '已完成',
        priority: '高',
        dependencies: ['用户管理模块'],
        createdAt: '2024-03-10',
        assignee: '李四',
      },
      'REQ-20240415-002': {
        title: '移动端响应式适配',
        description: '将现有 Web 应用改造为响应式设计，支持移动端、平板等多种设备访问',
        status: '计划中',
        priority: '中',
        dependencies: ['前端重构'],
        createdAt: '2024-04-15',
        assignee: '王五',
      },
    };

    const requirement = mockRequirements[reqId];
    
    if (!requirement) {
      return `需求 ${reqId} 未找到。请确认需求编号是否正确。`;
    }

    return `需求 ${reqId} 详情：
标题：${requirement.title}
描述：${requirement.description}
状态：${requirement.status}
优先级：${requirement.priority}
依赖项：${requirement.dependencies.join('、')}
创建时间：${requirement.createdAt}
负责人：${requirement.assignee}`;
  },
  {
    name: 'search_requirement',
    description: '根据需求编号查询需求详情。参数 reqId 格式：REQ-YYYYMMDD-NNN（例如：REQ-20240315-001）',
    schema: z.object({
      reqId: z.string().describe('需求编号，格式为 REQ-YYYYMMDD-NNN，例如 REQ-20240315-001'),
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
    if ((descLower.includes('登录') || descLower.includes('认证') || descLower.includes('auth')) &&
        (descLower.includes('jwt') || descLower.includes('session') || descLower.includes('token'))) {
      return `检测到潜在冲突：
- 与需求 REQ-20240310-005（OAuth 认证系统）存在功能重叠
- 冲突类型：认证方案冲突
- 详细说明：该需求涉及用户认证，而系统中已有 OAuth 认证方案。建议：
  1. 统一认证方案，避免维护两套系统
  2. 如果需要支持多种认证方式，建议采用认证策略模式
  3. 明确两种认证方式的适用场景和优先级
- 建议解决方案：与 REQ-20240310-005 的负责人协调，制定统一的认证架构`;
    }
    
    // 检测数据统计相关的冲突
    if (descLower.includes('统计') || descLower.includes('报表') || descLower.includes('数据分析')) {
      return `检测到潜在依赖：
- 需求可能依赖现有的数据统计模块
- 建议：确认与数据统计模块的接口兼容性
- 注意事项：如果需要实时统计，需要评估性能影响`;
    }
    
    // 检测移动端相关的冲突
    if (descLower.includes('移动') || descLower.includes('响应式') || descLower.includes('mobile')) {
      return `检测到潜在依赖：
- 与需求 REQ-20240415-002（移动端响应式适配）存在依赖关系
- 建议：确认响应式改造完成后再实施本需求
- 注意事项：需要考虑移动端的用户体验和性能优化`;
    }
    
    // 未检测到明显冲突
    return `未检测到明显冲突。需求 ${reqId} 可以正常推进。
建议：
1. 在实施前再次确认与相关模块的接口兼容性
2. 关注性能和安全性要求
3. 及时与相关团队沟通协调`;
  },
  {
    name: 'check_conflicts',
    description: '检测需求是否与现有需求冲突。需要提供需求编号和功能描述，返回冲突检测结果和解决建议',
    schema: z.object({
      reqId: z.string().describe('待检测的需求编号，格式为 REQ-YYYYMMDD-NNN'),
      description: z.string().describe('需求的功能描述，用于分析潜在冲突'),
    }),
  }
);

/**
 * 导出工具数组，供 ReAct 子图使用
 */
export const analysisTools = [searchRequirementTool, checkConflictsTool];
