/**
 * test-subgraph-debug.ts
 * 
 * 调试 ReAct 子图执行情况
 */
import 'dotenv/config';
import { createChatModel } from '../model.factory';
import { createAnalysisGraph } from './requirement-analysis-graph';
import { loadLangChainConfig, getApiKeys } from '../../config/load-langchain-config';

async function debugSubGraph() {
  console.log('=== 调试 ReAct 子图 ===\n');

  const config = loadLangChainConfig();
  const keys = getApiKeys();

  const model = createChatModel({
    modelConfigId: 'test',
    modelName: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    baseUrl: keys.openaiBaseUrl,
    apiKey: keys.openaiApiKey,
  });

  const graph = createAnalysisGraph(model);

  const testInput = '分析一个简单的用户登录功能需求：用户可以使用邮箱和密码登录系统';

  console.log('输入：', testInput);
  console.log('\n开始执行图...\n');

  try {
    const result = await graph.invoke({
      input: testInput,
      retrievedContext: '无相关参考文档',
      messages: [],
    });

    console.log('\n执行完成！\n');
    console.log('=== 结果检查 ===');
    console.log('intent:', result.intent);
    console.log('extracted 存在:', !!result.extracted);
    console.log('clarified 存在:', !!result.clarified);
    console.log('analysisResult 存在:', !!result.analysisResult);
    console.log('analysisResult 长度:', result.analysisResult?.length || 0);
    console.log('riskResult 存在:', !!result.riskResult);
    console.log('summary 存在:', !!result.summary);
    
    console.log('\n=== analysisResult 内容（前 500 字符）===');
    console.log(result.analysisResult?.substring(0, 500) || '(空)');

    console.log('\n=== messages 数量 ===');
    console.log('总消息数:', result.messages?.length || 0);
    
    if (result.messages && result.messages.length > 0) {
      console.log('\n=== 消息类型统计 ===');
      const messageTypes = result.messages.map((m: any) => m._getType?.() || 'unknown');
      const typeCounts = messageTypes.reduce((acc: any, type: string) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      console.log(typeCounts);
    }

  } catch (error) {
    console.error('执行失败：', error);
    if (error instanceof Error) {
      console.error('错误堆栈：', error.stack);
    }
  }
}

debugSubGraph();
