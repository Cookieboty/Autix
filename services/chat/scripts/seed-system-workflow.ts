#!/usr/bin/env bun
/**
 * 仅初始化默认系统工作流（幂等）。
 * Docker 启动时在 migrate deploy 之后、应用启动之前运行。
 *
 * 用法: bun run scripts/seed-system-workflow.ts
 * 环境变量: CHAT_DATABASE_URL 必填
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.CHAT_DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const AUTHOR_ID = process.env.AUTHOR_ID || 'seed-author';

async function main() {
  const existing = await prisma.agents.findFirst({
    where: { isSystem: true },
    include: { workflow: true },
  });

  if (existing?.workflow?.isDefault) {
    console.log('⏭  默认系统工作流已存在，跳过');
    return;
  }

  const agent =
    existing ??
    (await prisma.agents.create({
      data: {
        title: '默认产品工作流',
        description:
          '从一句话想法到可交付页面代码的全流程工作流。依次产出需求文档、视觉设计稿、技术文档（可选）、页面代码。',
        category: '产品',
        systemPrompt:
          '你是一个产品全流程工作流 Agent。按阶段依次产出高质量的交付物。每个阶段只专注当前任务，不要提前执行下一阶段。产出后给出对下一步的建议。',
        toolBindings: { mcps: [], skills: [] } as object,
        defaultModel: 'gpt-5',
        variables: [] as object,
        coverImage: '',
        exampleMedia: [],
        tags: ['工作流', 'PRD', '设计稿', '代码', '系统'],
        pointsCost: 0,
        isSystem: true,
        executionMode: 'workflow',
        runtimeRequirement: 'CLOUD',
        runtimeDetectedBy: 'AUTO',
        runtimeReason: '系统内置工作流',
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: 0,
        likeCount: 0,
        publishedAt: new Date(),
      },
    }));

  await prisma.agent_workflows.create({
    data: {
      agentId: agent.id,
      isDefault: true,
      version: 1,
      steps: {
        create: [
          {
            stepKey: 'prd',
            displayName: '需求文档',
            isOptional: false,
            sortOrder: 0,
            dependencies: [],
            inputArtifactKeys: [],
            executorType: 'deepagent',
            artifactType: 'MARKDOWN',
            promptTemplate: `你是资深产品经理。根据用户的需求描述，产出一份结构化的 PRD（产品需求文档）。

用户输入：
{{userInput}}

{{resources}}

请按以下结构输出：

## 1. 背景与价值
## 2. 目标（SMART）
## 3. 用户与场景
## 4. 功能需求（按 P0/P1/P2）
## 5. 非功能需求
## 6. 验收标准（GIVEN/WHEN/THEN）
## 7. 风险与依赖
## 8. 里程碑`,
            validationSchema: {
              requiredSections: ['背景', '目标', '功能需求', '验收标准'],
            } as object,
            criticEnabled: true,
            criticPromptTemplate: `评审 PRD 质量。维度：完整性、可执行性、验收标准、一致性。给出 0-1 分数和改进建议。`,
            criticPassThreshold: 0.7,
            maxRefineAttempts: 2,
          },
          {
            stepKey: 'visual_design',
            displayName: '视觉设计稿',
            isOptional: false,
            sortOrder: 1,
            dependencies: ['prd'],
            inputArtifactKeys: ['prd'],
            executorType: 'deepagent',
            artifactType: 'MARKDOWN',
            promptTemplate: `你是资深 UI/UX 设计师。根据以下需求文档，产出详细的视觉设计稿。

需求文档：
{{artifact:prd}}

用户补充说明：
{{userInput}}

{{resources}}

请按以下结构输出：
## 1. 设计理念
## 2. 信息架构
## 3. 页面设计
## 4. 组件规范
## 5. 响应式适配
## 6. 交互细节`,
            validationSchema: {
              requiredSections: ['设计理念', '页面设计', '组件规范'],
            } as object,
            criticEnabled: true,
            criticPromptTemplate: `评审视觉设计稿：与 PRD 一致性、可实现性、用户体验、规范完整度。给出 0-1 分数和改进建议。`,
            criticPassThreshold: 0.7,
            maxRefineAttempts: 2,
          },
          {
            stepKey: 'technical_doc',
            displayName: '技术文档',
            isOptional: true,
            sortOrder: 2,
            dependencies: ['prd', 'visual_design'],
            inputArtifactKeys: ['prd', 'visual_design'],
            executorType: 'deepagent',
            artifactType: 'MARKDOWN',
            promptTemplate: `你是资深全栈工程师。根据需求文档和视觉设计稿，产出技术设计文档。

需求文档：
{{artifact:prd}}

视觉设计稿：
{{artifact:visual_design}}

用户补充说明：
{{userInput}}

{{resources}}

结构：技术选型、数据模型、API 设计、组件架构、关键实现、部署方案。`,
            validationSchema: {
              requiredSections: ['技术选型', '数据模型', '组件架构'],
            } as object,
            criticEnabled: false,
            maxRefineAttempts: 2,
          },
          {
            stepKey: 'page_code',
            displayName: '页面代码',
            isOptional: false,
            sortOrder: 3,
            dependencies: ['visual_design'],
            inputArtifactKeys: ['prd', 'visual_design', 'technical_doc'],
            executorType: 'deepagent',
            artifactType: 'CODE',
            promptTemplate: `你是资深前端工程师。根据设计文档产出可运行的页面代码。

需求文档：
{{artifact:prd}}

视觉设计稿：
{{artifact:visual_design}}

{{#artifact:technical_doc}}
技术文档：
{{artifact:technical_doc}}
{{/artifact:technical_doc}}

用户补充说明：
{{userInput}}

{{resources}}

要求：React + TypeScript + Tailwind CSS，组件化，可直接运行。`,
            validationSchema: { codeCheck: true } as object,
            criticEnabled: true,
            criticPromptTemplate: `评审页面代码：与设计稿一致性、代码质量、可运行性、用户体验。给出 0-1 分数和改进建议。`,
            criticPassThreshold: 0.65,
            maxRefineAttempts: 3,
          },
        ],
      },
    },
  });

  console.log('✅ 默认系统工作流已创建');
}

main()
  .catch((e) => {
    console.error('❌ seed-system-workflow 失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
