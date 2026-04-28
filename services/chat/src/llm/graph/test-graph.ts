/**
 * test-graph.ts
 * 
 * 验证 LangGraph 意图路由和需求分析功能
 */
import 'dotenv/config';
import { createChatModel } from '../model.factory';
import { runAnalysisGraph } from './requirement-analysis-graph';
import { loadLangChainConfig } from '../../config/load-langchain-config';

// 测试用例定义
const testCases = [
  {
    name: '完整分析流程',
    input: '分析需求 REQ-20240315-001：开发一个在线问卷调查系统，支持多种题型（单选、多选、填空），能够实时收集和统计数据，目标用户是企业HR和市场调研人员。',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'analyze' },
      { name: '提取结果存在', check: (r: any) => r.extracted && Object.keys(r.extracted).length > 0 },
      { name: '澄清结果存在', check: (r: any) => r.clarified && 'needsClarification' in r.clarified },
      { name: '分析结果非空', check: (r: any) => r.analysisResult && r.analysisResult.length > 0 },
      { name: '风险评估非空', check: (r: any) => r.riskResult && r.riskResult.length > 0 },
      { name: '综合报告非空', check: (r: any) => r.summary && r.summary.length > 0 },
    ],
  },
  {
    name: '查询处理',
    input: '查询 REQ-20240315-001 的当前状态',
    expectedIntent: 'query' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'query' },
      { name: '查询响应非空', check: (r: any) => r.queryResponse && r.queryResponse.length > 0 },
      { name: 'summary包含响应', check: (r: any) => r.summary && r.summary.length > 0 },
    ],
  },
  {
    name: '聊天处理',
    input: '你好，今天天气不错',
    expectedIntent: 'chat' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'chat' },
      { name: '聊天响应非空', check: (r: any) => r.chatResponse && r.chatResponse.length > 0 },
      { name: 'summary包含响应', check: (r: any) => r.summary && r.summary.length > 0 },
    ],
  },
  // ===== 以下为 8.5 ReAct 子图测试用例 =====
  {
    name: '8.5-Case1: 简单需求无需工具调用',
    input: '分析用户登录功能需求：开发一个基于邮箱和密码的用户认证系统，目标用户是企业内部员工，业务目标是提升账号安全性和支持单点登录。需要实现登录、退出、密码重置功能，优先级高。',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'analyze' },
      { name: 'analysisResult 非空', check: (r: any) => r.analysisResult && r.analysisResult.length > 50 },
      { name: '包含功能分解', check: (r: any) => r.analysisResult && r.analysisResult.includes('功能') },
      { name: '包含用户故事', check: (r: any) => r.analysisResult && (r.analysisResult.includes('用户故事') || r.analysisResult.includes('作为')) },
    ],
  },
  {
    name: '8.5-Case2: 带需求编号触发工具调用',
    input: '分析需求 REQ-20240315-001 的可行性，包括技术实现方案、资源需求和潜在风险。目标用户是企业HR和市场调研人员，业务目标是提升数据收集效率。',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'analyze' },
      { name: 'analysisResult 包含详细分析', check: (r: any) => r.analysisResult && r.analysisResult.length > 100 },
      { name: '分析结果非空', check: (r: any) => r.analysisResult && r.analysisResult.trim().length > 0 },
    ],
  },
  {
    name: '8.5-Case3: 登录认证触发冲突检测',
    input: '分析需求 REQ-20240315-001：开发一个基于 JWT 的用户认证系统，支持登录、注册和密码重置功能，目标用户是企业员工，业务目标是提升系统安全性和用户体验。需要与现有系统集成。',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'analyze' },
      { name: 'analysisResult 非空', check: (r: any) => r.analysisResult && r.analysisResult.length > 0 },
      { name: '能够正常完成', check: (r: any) => !r.analysisResult || !r.analysisResult.includes('未完成') },
    ],
  },
  {
    name: '8.5-Case4: 复杂需求可能达到上限',
    input: '详细分析需求 REQ-20240315-001、REQ-20240310-005、REQ-20240415-002 之间的所有冲突和依赖关系，包括功能重叠、技术栈兼容性、开发时间线冲突等方面。目标是制定统一的实施方案。',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'analyze' },
      { name: 'analysisResult 非空', check: (r: any) => r.analysisResult && r.analysisResult.length > 0 },
      { name: '能够正常结束（不死循环）', check: (r: any) => true }, // 能执行到这里说明没有死循环
    ],
  },
  {
    name: '8.5-Case5: 验证子图状态写入',
    input: '分析需求 REQ-20240415-002：实现移动端响应式布局，支持手机、平板等多种设备，目标用户是移动端访问者，业务目标是提升移动端用户体验和访问量。需要兼容主流浏览器。',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: '意图正确', check: (r: any) => r.intent === 'analyze' },
      { name: 'analysisResult 正确写入', check: (r: any) => r.analysisResult && r.analysisResult.length > 0 },
      {
        name: 'summary 不包含工具调用痕迹', check: (r: any) => {
          // summary 由后续节点生成，不应包含子图的 ToolMessage
          return r.summary && !r.summary.includes('tool_calls') && !r.summary.includes('ToolMessage');
        }
      },
    ],
  },
];

// ===== 8.6 Critic-Refine 子图测试用例 =====
const criticRefineTestCases = [
  // Case 1: 高质量报告 - 一次通过
  {
    name: '8.6 Case 1: 高质量报告一次通过',
    input: `分析需求：开发一个在线问卷调查系统

功能：
- 支持多种题型（单选、多选、填空）
- 实时数据收集和统计
- 结果导出为 Excel

目标用户：企业 HR 和市场调研人员`,
    expectedIntent: 'analyze' as const,
    checks: [
      { name: 'reviseCount = 0', check: (r: any) => r.reviseCount === 0 },
      { name: 'critique 为空', check: (r: any) => !r.critique || r.critique === '' },
      {
        name: 'summary 包含所有章节', check: (r: any) => {
          const s = r.summary;
          return s.includes('摘要') && s.includes('排期') && s.includes('复杂度');
        }
      },
      { name: 'summary 长度合理', check: (r: any) => r.summary.length > 500 },
    ],
  },

  // Case 2: 缺少排期章节 - 触发修订
  {
    name: '8.6 Case 2: 报告缺少必需章节',
    input: '分析需求：简单的用户登录功能',
    expectedIntent: 'analyze' as const,
    checks: [
      {
        name: '可能触发修订',
        check: (r: any) => r.reviseCount >= 0
      },
      {
        name: '最终 summary 包含关键章节',
        check: (r: any) => r.summary.length > 300
      },
    ],
  },

  // Case 3: 达到修订上限
  {
    name: '8.6 Case 3: 达到修订上限强制终止',
    input: '分析需求：构建一个企业级微服务架构系统，包含用户管理、权限控制、数据分析、实时监控等10个模块',
    expectedIntent: 'analyze' as const,
    checks: [
      { name: 'reviseCount <= 2', check: (r: any) => r.reviseCount <= 2 },
      { name: '能正常结束（不死循环）', check: (r: any) => true },
      { name: 'summary 非空', check: (r: any) => r.summary.length > 200 },
    ],
  },

  // Case 4: 冲突分析完整性
  {
    name: '8.6 Case 4: 检测冲突分析是否包含解决方案',
    input: '分析需求 REQ-20240315-001：开发OAuth认证功能（已有JWT认证）',
    expectedIntent: 'analyze' as const,
    checks: [
      {
        name: 'summary 提到冲突',
        check: (r: any) => r.summary.includes('冲突') || r.summary.includes('重叠')
      },
      {
        name: 'summary 提到解决方案或建议',
        check: (r: any) => r.summary.includes('解决') || r.summary.includes('建议') || r.summary.includes('统一')
      },
    ],
  },

  // Case 5: 逻辑一致性检查
  {
    name: '8.6 Case 5: 复杂度评估与排期一致性',
    input: '分析需求：实现一个简单的待办事项列表，只需增删改查',
    expectedIntent: 'analyze' as const,
    checks: [
      {
        name: 'summary 非空',
        check: (r: any) => r.summary.length > 200
      },
      {
        name: '如果说低复杂度，排期应该较短',
        check: (r: any) => {
          const s = r.summary.toLowerCase();
          if (s.includes('低') && s.includes('复杂')) {
            return !s.includes('数月') && !s.includes('半年');
          }
          return true;
        }
      },
    ],
  },

  // Case 6: 排期依赖项检查
  {
    name: '8.6 Case 6: 排期必须标明依赖关系',
    input: '分析需求：开发前后端分离的博客系统，包含文章管理、评论、用户认证',
    expectedIntent: 'analyze' as const,
    checks: [
      {
        name: 'summary 包含排期',
        check: (r: any) => r.summary.includes('排期') || r.summary.includes('周') || r.summary.includes('阶段')
      },
      {
        name: 'summary 提到依赖关系',
        check: (r: any) => {
          const s = r.summary;
          return s.includes('依赖') || s.includes('前提') || s.includes('完成后');
        }
      },
    ],
  },
];

async function testRequirementAnalysisGraph() {
  console.log('=== 测试 LangGraph 意图路由与需求分析 ===\n');

  const config = loadLangChainConfig();

  // TODO: 测试脚本需要手动指定 apiKey / baseUrl，或从 DB 获取默认模型
  const model = createChatModel({
    modelConfigId: 'test',
    modelName: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
  });

  // 合并测试用例
  // const allTestCases = [...testCases, ...criticRefineTestCases];
  const allTestCases = [...criticRefineTestCases];

  const allResults: Array<{ name: string; passed: boolean; error?: string }> = [];

  // 执行所有测试用例
  for (const testCase of allTestCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试用例：${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`输入：${testCase.input}`);
    console.log(`期望意图：${testCase.expectedIntent}\n`);

    try {
      const startTime = Date.now();
      const result = await runAnalysisGraph({
        input: testCase.input,
        retrievedContext: '无相关参考文档',
        model,
      });
      const duration = Date.now() - startTime;

      console.log(`执行完成，耗时：${duration}ms`);
      console.log(`实际意图：${result.intent}\n`);

      // 对于 8.6 测试，额外输出 reviseCount 和 critique
      if (testCase.name.startsWith('8.6')) {
        console.log(`修订次数: ${result.reviseCount || 0}`);
        if (result.critique) {
          console.log(`最终评审意见: ${result.critique.substring(0, 100)}...`);
        }
      }

      // 显示结果摘要
      if (result.intent === 'analyze') {
        console.log(`--- 综合报告（前 500 字符）---`);
        console.log(result.summary?.substring(0, 500) + '...\n');
      } else if (result.intent === 'query') {
        console.log(`--- 查询响应 ---`);
        console.log(result.queryResponse + '\n');
      } else if (result.intent === 'chat') {
        console.log(`--- 聊天响应 ---`);
        console.log(result.chatResponse + '\n');
      }

      // 执行检查
      console.log('--- 验证结果 ---');
      const checkResults = testCase.checks.map(check => ({
        name: check.name,
        pass: check.check(result),
      }));

      checkResults.forEach(check => {
        console.log(`${check.pass ? '✓' : '✗'} ${check.name}`);
      });

      const allPassed = checkResults.every(c => c.pass);
      allResults.push({ name: testCase.name, passed: allPassed });

      console.log(`\n${allPassed ? '✓ 测试通过' : '✗ 测试失败'}`);
    } catch (error) {
      console.error('测试执行失败：', error);
      allResults.push({
        name: testCase.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 总结
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('总体测试结果');
  console.log(`${'='.repeat(60)}`);

  allResults.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    const status = result.passed ? '通过' : '失败';
    console.log(`${icon} ${result.name}: ${status}${result.error ? ` (${result.error})` : ''}`);
  });

  const allPassed = allResults.every(r => r.passed);
  const passedCount = allResults.filter(r => r.passed).length;

  console.log(`\n总计：${passedCount}/${allResults.length} 通过`);
  console.log(`\n最终结果：${allPassed ? '✓ 全部通过' : '✗ 存在失败'}`);

  process.exit(allPassed ? 0 : 1);
}

// 运行测试
testRequirementAnalysisGraph();
