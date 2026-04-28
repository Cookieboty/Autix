import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactType, ModelType, artifacts, artifact_versions } from '@prisma/client';
import { createChatModelFromDbConfig } from '../llm/model.factory';
import { ModelConfigService } from '../model-config/model-config.service';

@Injectable()
export class ArtifactService {
  constructor(
    private prisma: PrismaService,
    private readonly modelConfigService: ModelConfigService,
  ) {}

  private async getDefaultModel() {
    const config = await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) {
      throw new Error('未配置默认模型，请在模型配置中设置一个默认的 general 类型模型');
    }
    return createChatModelFromDbConfig(config);
  }

  // 创建或更新产物（AI生成时调用）
  async upsertArtifact(data: {
    conversationId: string;
    userId: string;
    title: string;
    type: ArtifactType;
    content: string;
    sourceMessageId?: string;
  }): Promise<artifacts> {
    // 检查是否已存在
    const existing = await this.prisma.artifacts.findUnique({
      where: { conversationId: data.conversationId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (existing) {
      // 更新现有产物（AI重新生成）
      const newVersion = existing.currentVersion + 1;

      // 使用事务同时更新产物和会话标题
      return this.prisma.$transaction(async (tx) => {
        const updatedArtifact = await tx.artifacts.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            content: data.content,
            currentVersion: newVersion,
            artifact_versions: {
              create: {
                version: newVersion,
                content: data.content,
                sourcetags: ['AI'],
                sourceMessageId: data.sourceMessageId,
              },
            },
          },
        });

        // 同步更新会话标题
        await tx.conversations.update({
          where: { id: data.conversationId },
          data: { title: data.title },
        });

        return updatedArtifact;
      });
    }

    // 创建新产物（同时更新会话标题）
    return this.prisma.$transaction(async (tx) => {
      // sourceMessageId 只属于 artifact_versions，需要从 artifacts.create 的 data 中排除
      const { sourceMessageId, ...artifactData } = data;
      
      const artifact = await tx.artifacts.create({
        data: {
          ...artifactData,
          currentVersion: 1,
          artifact_versions: {
            create: {
              version: 1,
              content: data.content,
              sourcetags: ['AI'],
              sourceMessageId: sourceMessageId,
            },
          },
        },
        include: { artifact_versions: true },
      });

        // 同步更新会话标题
        await tx.conversations.update({
        where: { id: data.conversationId },
        data: { title: data.title },
      });

      return artifact;
    });
  }

  // 使用 LLM 生成标题
  async generateTitle(summaryContent: string): Promise<string> {
    const prompt = `请为以下需求分析报告生成一个简洁的标题（10-20字）：

${summaryContent.substring(0, 500)}

只返回标题文本，不要其他内容。`;

    const model = await this.getDefaultModel();
    const response = await model.invoke(prompt);

    return response.content.toString().trim().replace(/^["']|["']$/g, '');
  }

  // 更新标题（同时更新关联的会话标题）
  async updateTitle(artifactId: string, title: string): Promise<artifacts> {
    const artifact = await this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
      include: { conversations: true },
    });

    // 使用事务同时更新产物和会话标题
    return this.prisma.$transaction(async (tx) => {
      // 更新产物标题
      const updatedArtifact = await tx.artifacts.update({
        where: { id: artifactId },
        data: { title },
      });

        // 同步更新会话标题
        await tx.conversations.update({
        where: { id: artifact.conversationId },
        data: { title },
      });

      return updatedArtifact;
    });
  }

  // 用户编辑产物
  async updateArtifact(
    artifactId: string,
    content: string,
    changelog?: string,
  ): Promise<artifacts> {
    const artifact = await this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    // 从上一个版本继承 sourcetags，并添加 HUMAN
    const lastVersion = artifact.artifact_versions[0];
    const inheritedTags = lastVersion?.sourcetags || [];
    const newTags = inheritedTags.includes('HUMAN')
      ? inheritedTags
      : [...inheritedTags, 'HUMAN'];

    const newVersion = artifact.currentVersion + 1;

    return this.prisma.artifacts.update({
      where: { id: artifactId },
      data: {
        content,
        currentVersion: newVersion,
        artifact_versions: {
          create: {
            version: newVersion,
            content,
            changelog,
            sourcetags: newTags,
          },
        },
      },
    });
  }

  // 流式 AI 优化
  async optimizeArtifactStream(
    artifactId: string,
    instruction: string,
    res: Response,
  ): Promise<void> {
    const artifact = await this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    const lastVersion = artifact.artifact_versions[0];
    const originalContent = artifact.content;
    const inheritedTags = lastVersion?.sourcetags || ['AI'];

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const optimizeAgent = await this.getDefaultModel();
      const systemPrompt = `你是一个专业的文档优化助手。

用户优化需求：${instruction}

原始文档内容：
\`\`\`markdown
${originalContent}
\`\`\`

请根据用户需求优化文档，要求：
1. 保持文档的整体结构和格式
2. 只针对用户提出的问题进行改进
3. 不要删除重要信息
4. 保持 Markdown 标题层级和代码块格式
5. 直接返回优化后的完整文档，不要额外解释`;

      let accumulatedContent = '';

      // 流式生成
      const stream = await optimizeAgent.stream(systemPrompt);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        accumulatedContent += content;

        // 发送流式事件
        res.write(
          `data: ${JSON.stringify({
            type: 'markdown',
            content,
          })}\n\n`,
        );
      }

      // 保存新版本
      const newVersion = artifact.currentVersion + 1;
      await this.prisma.artifacts.update({
        where: { id: artifactId },
        data: {
          content: accumulatedContent,
          currentVersion: newVersion,
          artifact_versions: {
            create: {
              version: newVersion,
              content: accumulatedContent,
              changelog: `AI优化：${instruction}`,
              sourcetags: inheritedTags,
            },
          },
        },
      });

      // 发送完成事件
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          version: newVersion,
        })}\n\n`,
      );

      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`,
      );
      res.end();
    }
  }

  // 获取版本历史
  async getVersions(artifactId: string): Promise<artifact_versions[]> {
    return this.prisma.artifact_versions.findMany({
      where: { artifactId },
      orderBy: { version: 'desc' },
    });
  }

  // 恢复到指定版本
  async revertToVersion(
    artifactId: string,
    targetVersion: number,
  ): Promise<artifacts> {
    const version = await this.prisma.artifact_versions.findUniqueOrThrow({
      where: { artifactId_version: { artifactId, version: targetVersion } },
    });

    const artifact = await this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
    });

    // 从目标版本继承 sourcetags，并添加 HUMAN（恢复是用户操作）
    const inheritedTags = version.sourcetags || [];
    const newTags = inheritedTags.includes('HUMAN')
      ? inheritedTags
      : [...inheritedTags, 'HUMAN'];

    const newVersion = artifact.currentVersion + 1;

    return this.prisma.artifacts.update({
      where: { id: artifactId },
      data: {
        content: version.content,
        currentVersion: newVersion,
        artifact_versions: {
          create: {
            version: newVersion,
            content: version.content,
            changelog: `恢复到版本 ${targetVersion}`,
            sourcetags: newTags,
          },
        },
      },
      include: { artifact_versions: true },
    });
  }

  // 根据会话ID查找产物
  async findByConversation(conversationId: string): Promise<artifacts | null> {
    return this.prisma.artifacts.findUnique({
      where: { conversationId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 10, // 只返回最近10个版本
        },
      },
    });
  }

  // 根据ID查找产物
  async findById(artifactId: string): Promise<artifacts> {
    return this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
    });
  }

  // 删除产物
  async deleteArtifact(artifactId: string): Promise<void> {
    await this.prisma.artifacts.delete({
      where: { id: artifactId },
    });
  }
}
