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
      throw new Error('No default model configured. Please set a default general-type model in model configuration');
    }
    return config;
  }

  private async getDefaultModelConfigForUser(userId: string) {
    const config = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.general,
      userId,
    );
    if (!config) {
      throw new Error('No default general-type model available for the current membership');
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
    const prompt = `Please generate a concise title (10-20 characters) for the following requirements analysis report:

${summaryContent.substring(0, 500)}

Return only the title text, nothing else.`;

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
      const systemPrompt = `You are a professional document optimization assistant.

User optimization request: ${instruction}

Original document content:
\`\`\`markdown
${originalContent}
\`\`\`

Optimize the document according to the user's request, with these requirements:
1. Preserve the document's overall structure and formatting
2. Only improve the issues the user raised
3. Do not remove important information
4. Preserve Markdown heading levels and code block formatting
5. Return the complete optimized document directly, without extra explanation`;
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
        remark: `Artifact document AI optimization · ${this.formatBillingModel(
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
        changelog: `AI optimization: ${instruction}`,
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
