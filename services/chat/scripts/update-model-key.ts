#!/usr/bin/env bun
/**
 * 更新现有模型配置的 API Key
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { input, confirm } from '@inquirer/prompts';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(import.meta.dir, '../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔑 更新模型 API Key\n');

  // 查找现有模型
  const models = await prisma.model_configs.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (models.length === 0) {
    console.log('❌ 没有找到活跃的模型配置');
    console.log('   请先运行: bun run scripts/setup-model.ts\n');
    return;
  }

  console.log('找到以下模型配置:\n');
  models.forEach((m, idx) => {
    console.log(`${idx + 1}. ${m.name} (${m.model})`);
    console.log(`   ID: ${m.id}`);
    console.log(`   Base URL: ${m.baseUrl}`);
    console.log(`   默认: ${m.isDefault ? '是' : '否'}`);
    console.log(`   当前 Key: ${m.apiKey ? m.apiKey.substring(0, 10) + '...' : '(空)'}\n`);
  });

  const modelId = await input({
    message: '输入要更新的模型 ID (或按回车选择第一个):',
    default: models[0].id,
  });

  const model = models.find((m) => m.id === modelId);
  if (!model) {
    console.log('❌ 未找到指定的模型配置');
    return;
  }

  console.log(`\n正在更新: ${model.name}`);

  const newKey = await input({
    message: '新的 API Key (留空使用 .env 中的配置):',
    default: '',
  });

  const finalKey = newKey || process.env.OPENAI_API_KEY || null;

  if (!finalKey) {
    console.log('❌ 未提供 API key，且 .env 中也没有配置');
    return;
  }

  // 测试新 Key
  const shouldTest = await confirm({
    message: '要先测试新 Key 是否有效吗?',
    default: true,
  });

  if (shouldTest) {
    console.log('\n🔍 测试 API 连接...');
    try {
      const response = await fetch(`${model.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finalKey}`,
        },
        body: JSON.stringify({
          model: model.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        console.log('✅ API 连接成功！');
      } else {
        const errorText = await response.text();
        console.log(`⚠️  API 返回错误 (${response.status}):`);
        console.log(`   ${errorText.substring(0, 200)}`);
        
        const proceed = await confirm({
          message: '仍然要更新此 Key 吗?',
          default: false,
        });
        
        if (!proceed) {
          console.log('❌ 已取消更新');
          return;
        }
      }
    } catch (error: any) {
      console.log(`❌ 无法连接到 API: ${error.message}`);
      
      const proceed = await confirm({
        message: '仍然要更新此 Key 吗?',
        default: false,
      });
      
      if (!proceed) {
        console.log('❌ 已取消更新');
        return;
      }
    }
  }

  // 更新数据库
  console.log('\n💾 更新数据库...');
  await prisma.model_configs.update({
    where: { id: model.id },
    data: { apiKey: finalKey },
  });

  console.log('✅ API Key 已更新！');
  console.log(`\n📝 后续步骤:`);
  console.log('1. 重启后端服务（如果正在运行）');
  console.log('2. 访问前端测试: http://localhost:3000\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
