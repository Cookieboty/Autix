/**
 * test-run-analysis.ts
 * 
 * 测试 runAnalysisGraph 函数的返回值
 */
import 'dotenv/config';
import { createChatModel } from '../model.factory';
import { runAnalysisGraph } from './requirement-analysis-graph';
import { loadLangChainConfig } from '../../config/load-langchain-config';

async function testRunAnalysisGraph() {
  console.log('=== 测试 runAnalysisGraph 函数 ===\n');

  const config = loadLangChainConfig();

  const model = createChatModel({
    modelConfigId: 'test',
    modelName: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
  });

  const testInput = '分析一个简单的用户登录功能需求：用户可以使用邮箱和密码登录系统';

  console.log('输入：', testInput);
  console.log('\n开始执行...\n');

  try {
    const result = await runAnalysisGraph({
      input: testInput,
      retrievedContext: '无相关参考文档',
      model,
    });

    console.log('\n执行完成！\n');
    console.log('=== 返回值检查 ===');
    console.log('result 类型:', typeof result);
    console.log('result 的键:', Object.keys(result));
    console.log('\n--- 各字段情况 ---');
    console.log('intent:', result.intent, `(${typeof result.intent})`);
    console.log('summary 存在:', result.summary !== undefined);
    console.log('summary 类型:', typeof result.summary);
    console.log('summary 长度:', result.summary?.length || 0);
    console.log('extracted 存在:', result.extracted !== undefined);
    console.log('extracted:', JSON.stringify(result.extracted, null, 2));
    console.log('clarified 存在:', result.clarified !== undefined);
    console.log('clarified:', JSON.stringify(result.clarified, null, 2));
    console.log('analysisResult 存在:', result.analysisResult !== undefined);
    console.log('analysisResult 类型:', typeof result.analysisResult);
    console.log('analysisResult 长度:', result.analysisResult?.length || 0);
    console.log('riskResult 存在:', result.riskResult !== undefined);
    console.log('riskResult 类型:', typeof result.riskResult);
    console.log('riskResult 长度:', result.riskResult?.length || 0);

    console.log('\n=== analysisResult 内容（前 300 字符）===');
    console.log(result.analysisResult?.substring(0, 300) || '(空)');

    console.log('\n=== riskResult 内容（前 300 字符）===');
    console.log(result.riskResult?.substring(0, 300) || '(空)');

    console.log('\n=== summary 内容（前 300 字符）===');
    console.log(result.summary?.substring(0, 300) || '(空)');

  } catch (error) {
    console.error('执行失败：', error);
    if (error instanceof Error) {
      console.error('错误堆栈：', error.stack);
    }
  }
}

testRunAnalysisGraph();
