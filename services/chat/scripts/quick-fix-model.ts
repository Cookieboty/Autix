#!/usr/bin/env bun
/**
 * 快速修复：创建默认模型配置
 * 这个脚本会读取 .env 中的配置并创建一个数据库记录
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { join } from 'path';

// 加载 .env 文件
config({ path: join(import.meta.dir, '../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 快速修复模型配置...\n');

  // 检查是否已有默认模型
  const existing = await prisma.model_configs.findFirst({
    where: { isDefault: true, type: 'general' },
  });

  if (existing) {
    console.log('✅ 已存在默认模型配置:');
    console.log(`   ID: ${existing.id}`);
    console.log(`   名称: ${existing.name}`);
    console.log(`   模型: ${existing.model}`);
    console.log(`   Base URL: ${existing.baseUrl}`);
    console.log('\n如需重新配置，请先删除现有配置或运行: bun run scripts/setup-model.ts\n');
    return;
  }

  // 从环境变量读取配置
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    console.log('❌ 错误: .env 文件中未找到 OPENAI_API_KEY');
    console.log('\n请按以下步骤操作:');
    console.log('1. 获取一个有效的 API key（推荐提供商：DeepSeek, Groq, SiliconFlow）');
    console.log('2. 编辑 services/chat/.env 文件，更新 OPENAI_API_KEY');
    console.log('3. 重新运行此脚本: bun run scripts/quick-fix-model.ts\n');
    console.log('或者使用交互式配置: bun run scripts/setup-model.ts\n');
    process.exit(1);
  }

  // 创建模型配置
  const modelConfig = await prisma.model_configs.create({
    data: {
      name: '默认模型 (从 .env)',
      provider: 'openai',
      model: 'gpt-4o-mini', // 默认模型，根据实际 API 调整
      type: 'general',
      baseUrl: baseUrl,
      apiKey: apiKey,
      isActive: true,
      isDefault: true,
      visibility: 'public',
      priority: 100,
      capabilities: ['text'],
      metadata: {
        temperature: 0.7,
        maxTokens: 2048,
      },
    },
  });

  console.log('✅ 成功创建默认模型配置:');
  console.log(`   ID: ${modelConfig.id}`);
  console.log(`   名称: ${modelConfig.name}`);
  console.log(`   Base URL: ${modelConfig.baseUrl}`);
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  
  // 测试 API 连接
  console.log('\n🔍 测试 API 连接...');
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      console.log('✅ API 连接成功！系统已就绪。');
    } else {
      const errorText = await response.text();
      console.log(`⚠️  API 返回错误 (${response.status}):`);
      console.log(`   ${errorText.substring(0, 200)}`);
      console.log('\n请按以下步骤修复:');
      console.log('1. 检查 .env 中的 OPENAI_API_KEY 是否有效');
      console.log('2. 检查 OPENAI_BASE_URL 是否正确');
      console.log('3. 或使用其他 API 提供商: bun run scripts/setup-model.ts\n');
    }
  } catch (error: any) {
    console.log(`❌ 无法连接到 API: ${error.message}`);
    console.log('   请检查网络连接和 Base URL\n');
  }

  console.log('\n📝 后续步骤:');
  console.log('1. 如果 API 测试失败，请更新 .env 中的 OPENAI_API_KEY');
  console.log('2. 重启后端服务: cd services/chat && bun run dev');
  console.log('3. 访问前端测试: http://localhost:3000\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
