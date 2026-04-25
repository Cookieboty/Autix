#!/usr/bin/env bun
/**
 * 快速配置模型脚本
 * 用法: bun run scripts/setup-model.ts
 */

import { PrismaClient } from '@prisma/client';
import { input, select } from '@inquirer/prompts';

const prisma = new PrismaClient();

interface ModelPreset {
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  requiresApiKey: boolean;
  description: string;
}

const presets: Record<string, ModelPreset> = {
  deepseek: {
    name: 'DeepSeek Chat',
    provider: 'openai',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    description: 'DeepSeek API (需要 API key，性价比高)',
  },
  groq: {
    name: 'Groq Llama 3',
    provider: 'openai',
    model: 'llama-3.1-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    description: 'Groq (需要免费 API key，速度快)',
  },
  openrouter: {
    name: 'OpenRouter GPT-4',
    provider: 'openai',
    model: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    description: 'OpenRouter (支持多种模型)',
  },
  siliconflow: {
    name: 'SiliconFlow Qwen',
    provider: 'openai',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    baseUrl: 'https://api.siliconflow.cn/v1',
    requiresApiKey: true,
    description: 'SiliconFlow (国内可访问，免费额度)',
  },
  custom: {
    name: 'Custom OpenAI Compatible',
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    description: '自定义 OpenAI 兼容 API',
  },
};

async function main() {
  console.log('🚀 模型配置向导\n');

  // 1. 选择预设
  const presetChoice = await select({
    message: '选择一个 LLM 提供商:',
    choices: Object.entries(presets).map(([key, preset]) => ({
      name: preset.description,
      value: key,
    })),
  });

  const preset = presets[presetChoice];
  console.log(`\n✓ 选择了: ${preset.name}`);

  // 2. 自定义配置（如果是 custom）
  let finalName = preset.name;
  let finalModel = preset.model;
  let finalBaseUrl = preset.baseUrl;

  if (presetChoice === 'custom') {
    finalName = await input({
      message: '模型名称 (显示名称):',
      default: preset.name,
    });

    finalModel = await input({
      message: '模型 ID (model 参数):',
      default: preset.model,
    });

    finalBaseUrl = await input({
      message: 'API Base URL:',
      default: preset.baseUrl,
    });
  }

  // 3. 输入 API Key
  let apiKey: string | undefined;
  if (preset.requiresApiKey) {
    apiKey = await input({
      message: 'API Key (留空将使用 .env 中的配置):',
      default: '',
    });

    if (!apiKey) {
      console.log('⚠️  未提供 API key，将使用 .env 中的 OPENAI_API_KEY');
      apiKey = undefined;
    }
  }

  // 4. 检查是否已存在默认模型
  const existingDefault = await prisma.model_configs.findFirst({
    where: { isDefault: true, type: 'general' },
  });

  const shouldBeDefault = !existingDefault;

  // 5. 创建配置
  console.log('\n📝 创建模型配置...');
  const modelConfig = await prisma.model_configs.create({
    data: {
      name: finalName,
      provider: preset.provider,
      model: finalModel,
      type: 'general',
      baseUrl: finalBaseUrl,
      apiKey: apiKey,
      isActive: true,
      isDefault: shouldBeDefault,
      visibility: 'public',
      priority: 100,
      capabilities: ['text'],
      metadata: {
        temperature: 0.7,
        maxTokens: 2048,
      },
    },
  });

  console.log(`\n✅ 成功创建模型配置:`);
  console.log(`   ID: ${modelConfig.id}`);
  console.log(`   名称: ${modelConfig.name}`);
  console.log(`   模型: ${modelConfig.model}`);
  console.log(`   Base URL: ${modelConfig.baseUrl}`);
  console.log(`   默认模型: ${modelConfig.isDefault ? '是' : '否'}`);

  // 6. 测试连接（可选）
  const shouldTest = await select({
    message: '\n要测试 API 连接吗?',
    choices: [
      { name: '是', value: true },
      { name: '否', value: false },
    ],
  });

  if (shouldTest) {
    console.log('\n🔍 测试 API 连接...');
    try {
      const response = await fetch(`${finalBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        console.log('✅ API 连接成功！');
      } else {
        const error = await response.text();
        console.log(`❌ API 连接失败 (${response.status}): ${error}`);
        console.log('   请检查 API key 和 Base URL 是否正确');
      }
    } catch (error: any) {
      console.log(`❌ API 连接失败: ${error.message}`);
    }
  }

  console.log('\n🎉 配置完成！现在可以使用这个模型了。');
  console.log('   前端访问: http://localhost:3000/models');
  console.log('   或在聊天中直接使用\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
