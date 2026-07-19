import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { ArtifactType, ModelType, artifacts, artifact_versions } from '../../platform/prisma/generated';
import { createChatModelFromDbConfig } from '../llm/model.factory';
import { ModelConfigService } from '../model-config/model-config.service';
import { CallBillingService } from '../llm/billing/call-billing.service';
import { estimateTextTokens } from '../llm/billing/token-estimation';
import { ArtifactRepository } from './artifact.repository';

const ARTIFACT_OPTIMIZE_TASK_TYPE = 'prompt_optimize_pro';

@Injectable()
export class ArtifactService {
  constructor(
    private readonly artifactRepository: ArtifactRepository,
    private readonly modelConfigService: ModelConfigService,
    private readonly billing: CallBillingService,
  ) { }

  private async getDefaultModelConfig() {
    const config = await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) {
      throw new Error('未配置默认模型，请在模型配置中设置一个默认的 general 类型模型');
    }
    return config;
  }

  private async getDefaultModelConfigForUser(userId: string) {
    const config = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.general,
      userId,
    );
    if (!config) {
      throw new Error('未配置当前会员可用的默认 general 类型模型');
    }
    return config;
  }

  private async getDefaultModel() {
    const config = await this.getDefaultModelConfig();
    return createChatModelFromDbConfig(config);
  }

  async upsertArtifact(data: {
    conversationId: string;
    userId: string;
    title: string;
    type: ArtifactType;
    content: string;
    sourceMessageId?: string;
  }): Promise<artifacts> {
    return this.artifactRepository.upsertArtifact(data);
  }

  async generateTitle(summaryContent: string): Promise<string> {
    const prompt = `请为以下需求分析报告生成一个简洁的标题（10-20字）：

${summaryContent.substring(0, 500)}

只返回标题文本，不要其他内容。`;

    const model = await this.getDefaultModel();
    const response = await model.invoke(prompt);

    return response.content.toString().trim().replace(/^["']|["']$/g, '');
  }

  async updateTitle(artifactId: string, title: string): Promise<artifacts> {
    const artifact = await this.artifactRepository.findByIdWithConversation(artifactId);
    return this.artifactRepository.updateTitleWithConversation(
      artifactId,
      artifact.conversationId,
      title,
    );
  }

  // 用户编辑产物
  async updateArtifact(
    artifactId: string,
    content: string,
    changelog?: string,
  ): Promise<artifacts> {
    const artifact = await this.artifactRepository.findByIdWithLatestVersion(artifactId);

    const lastVersion = artifact.artifact_versions[0];
    const inheritedTags = lastVersion?.sourcetags || [];
    const newTags = inheritedTags.includes('HUMAN')
      ? inheritedTags
      : [...inheritedTags, 'HUMAN'];

    const newVersion = artifact.currentVersion + 1;

    return this.artifactRepository.updateArtifactWithVersion({
      artifactId,
      content,
      currentVersion: newVersion,
      changelog,
      sourcetags: newTags,
    });
  }

  // 流式 AI 优化
  async optimizeArtifactStream(
    artifactId: string,
    userId: string,
    instruction: string,
    res: Response,
  ): Promise<void> {
    const artifact = await this.artifactRepository.findByIdWithLatestVersion(artifactId);

    const lastVersion = artifact.artifact_versions[0];
    const originalContent = artifact.content;
    const inheritedTags = lastVersion?.sourcetags || ['AI'];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let holdId: string | null = null;
    try {
      const optimizeConfig = await this.getDefaultModelConfigForUser(userId);
      const optimizeAgent = createChatModelFromDbConfig(optimizeConfig);
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
      const inputTokens = estimateTextTokens(systemPrompt);
      const estimatedOutputTokens = Math.max(128, estimateTextTokens(originalContent));
      const hold = await this.billing.hold(userId, 0, {
        modelConfigId: optimizeConfig.id,
        modelName: optimizeConfig.model,
        requirePricing: true,
        pricing: {
          taskType: ARTIFACT_OPTIMIZE_TASK_TYPE,
          modelProvider: optimizeConfig.provider ?? undefined,
          modelName: optimizeConfig.model,
          inputTokens,
          outputTokens: estimatedOutputTokens,
        },
        remark: `Artifact 文档 AI 优化 · ${this.formatBillingModel(
          optimizeConfig.provider,
          optimizeConfig.model,
        )}`,
      });
      holdId = hold.holdId;

      let accumulatedContent = '';

      const stream = await optimizeAgent.stream(systemPrompt);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        accumulatedContent += content;

        res.write(
          `data: ${JSON.stringify({
            type: 'markdown',
            content,
          })}\n\n`,
        );
      }

      const newVersion = artifact.currentVersion + 1;
      await this.artifactRepository.updateArtifactWithVersion({
        artifactId,
        content: accumulatedContent,
        currentVersion: newVersion,
        changelog: `AI优化：${instruction}`,
        sourcetags: inheritedTags,
      });

      await this.billing.confirm(holdId, {
        taskType: ARTIFACT_OPTIMIZE_TASK_TYPE,
        modelProvider: optimizeConfig.provider ?? undefined,
        modelName: optimizeConfig.model,
        inputTokens,
        outputTokens: estimateTextTokens(accumulatedContent),
      });
      holdId = null;

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          version: newVersion,
        })}\n\n`,
      );

      res.end();
    } catch (error) {
      if (holdId) {
        await this.safeRefundArtifactOptimizeHold(holdId);
      }
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`,
      );
      res.end();
    }
  }

  private async safeRefundArtifactOptimizeHold(holdId: string) {
    try {
      await this.billing.refund(holdId);
    } catch {
      // SSE 已在错误路径上，退款失败只能由日志/账务巡检兜底，避免二次打断响应。
    }
  }

  private formatBillingModel(provider: string | null | undefined, model: string): string {
    return [provider, model].filter(Boolean).join('/') || model;
  }

  async getVersions(artifactId: string): Promise<artifact_versions[]> {
    return this.artifactRepository.getVersions(artifactId);
  }

  async revertToVersion(
    artifactId: string,
    targetVersion: number,
  ): Promise<artifacts> {
    const version = await this.artifactRepository.findVersion(
      artifactId,
      targetVersion,
    );

    const artifact = await this.artifactRepository.findById(artifactId);

    const inheritedTags = version.sourcetags || [];
    const newTags = inheritedTags.includes('HUMAN')
      ? inheritedTags
      : [...inheritedTags, 'HUMAN'];

    const newVersion = artifact.currentVersion + 1;

    return this.artifactRepository.revertToVersion({
      artifactId,
      currentVersion: newVersion,
      content: version.content,
      targetVersion,
      sourcetags: newTags,
    });
  }

  async findByConversation(conversationId: string): Promise<artifacts | null> {
    return this.artifactRepository.findByConversation(conversationId);
  }

  async findById(artifactId: string): Promise<artifacts> {
    return this.artifactRepository.findById(artifactId);
  }

  async deleteArtifact(artifactId: string): Promise<void> {
    await this.artifactRepository.deleteArtifact(artifactId);
  }

  /**
   * 把 workflow step artifact "晋升"为会话主 artifact。
   * 如果会话已有主 artifact，更新内容并增加版本；否则创建新的。
   */
  async promoteFromStep(
    runId: string,
    stepKey: string,
    conversationId: string,
    userId: string,
  ): Promise<artifacts> {
    const stepArtifact = await this.artifactRepository.findLatestStepArtifact(
      runId,
      stepKey,
    );

    if (!stepArtifact) {
      throw new Error(`Step artifact not found: runId=${runId}, stepKey=${stepKey}`);
    }

    const title = await this.generateTitle(stepArtifact.content);

    return this.upsertArtifact({
      conversationId,
      userId,
      title,
      type: stepArtifact.contentType,
      content: stepArtifact.content,
    });
  }
}
