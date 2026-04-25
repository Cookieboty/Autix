/**
 * test-graph.ts
 * 
 * 验证 LangGraph 意图路由和需求分析功能
 */
import 'dotenv/config';
import { createChatModel } from '../model.factory';
import { runAnalysisGraph } from './requirement-analysis-graph';
import { loadLangChainConfig, getApiKeys } from '../../config/load-langchain-config';

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
];

async function testRequirementAnalysisGraph() {
  console.log('=== 测试 LangGraph 意图路由与需求分析 ===\n');

  // 加载配置
  const config = loadLangChainConfig();
  const keys = getApiKeys();

  // 创建模型实例
  const model = createChatModel({
    modelConfigId: 'test',
    modelName: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    baseUrl: keys.openaiBaseUrl,
    apiKey: keys.openaiApiKey,
  });

  const allResults: Array<{ name: string; passed: boolean; error?: string }> = [];

  // 执行所有测试用例
  for (const testCase of testCases) {
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
