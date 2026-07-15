#!/usr/bin/env tsx
/**
 * 一键修复 API Key
 * 用法: API_KEY="your-key-here" pnpm --filter @autix/api fix:api-key
 */

import { createPrismaClient } from './db';

const prisma = createPrismaClient();

async function main() {
  const newApiKey = process.env.API_KEY || process.argv[2];

  if (!newApiKey) {
    console.log('❌ 请提供 API Key\n');
    console.log('方法 1: API_KEY="sk-xxx" pnpm --filter @autix/api fix:api-key');
    console.log('方法 2: pnpm --filter @autix/api fix:api-key "sk-xxx"\n');
    console.log('或使用交互式工具: pnpm --filter @autix/api update:model-key\n');
    process.exit(1);
  }

  console.log(`🔑 更新 API Key: ${newApiKey.substring(0, 10)}...\n`);

  // 查找默认模型
  const model = await prisma.model_configs.findFirst({
    where: { isDefault: true, type: 'general' },
  });

  if (!model) {
    console.log('❌ 未找到默认模型配置');
    console.log('   请先运行: pnpm exec tsx scripts/setup-model.ts\n');
    process.exit(1);
  }

  console.log(`找到默认模型: ${model.name} (${model.model})`);
  console.log(`Base URL: ${model.baseUrl}\n`);

  // 测试 API
  console.log('🔍 测试 API 连接...');
  try {
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newApiKey}`,
      },
      body: JSON.stringify({
        model: model.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`⚠️  API 测试失败 (${response.status}):`);
      console.log(`   ${error.substring(0, 300)}\n`);
      console.log('继续更新数据库，但请确认 API key 是否正确...\n');
    } else {
      console.log('✅ API 测试成功！\n');
    }
  } catch (error: any) {
    console.log(`⚠️  无法连接 API: ${error.message}`);
    console.log('继续更新数据库...\n');
  }

  // 更新数据库
  await prisma.model_configs.update({
    where: { id: model.id },
    data: { apiKey: newApiKey },
  });

  console.log('✅ API Key 已更新到数据库\n');
  console.log('📝 下一步:');
  console.log('   1. 重启后端: pnpm run dev:api');
  console.log('   2. 测试聊天: http://localhost:3000\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
