import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentKind, ResourceType } from '../../platform/prisma/generated';
import { ConversationRepository } from './conversation.repository';
import {
  addResourceDetailsToMap,
  attachResourceDetails,
  buildMentionPrompt,
  buildResourcePromptPayload,
  conversationKindForAttachedTemplate,
  conversationKindFromTemplatePresence,
  formatMentionResourceSection,
  getPromptResourceIds,
  groupResourceIdsByType,
  hasStartedAgentKindConflict,
  isActivatableResourceType,
  isDetailResourceType,
  isTemplateResourceType,
  parseMentionRefs,
  requiresResourceAcquisition,
  templateConflictMessage,
} from './conversation-resources.helpers';

@Injectable()
export class ConversationResourcesService {
  constructor(private readonly repository: ConversationRepository) {}

  async attach(
    userId: string,
    conversationId: string,
    type: ResourceType,
    resourceId: string,
  ) {
    if (!isActivatableResourceType(type)) {
      throw new BadRequestException(
        `资源类型 ${type} 不支持会话激活`,
      );
    }
    await this.requireOwnConversation(conversationId, userId);

    if (requiresResourceAcquisition(type)) {
      let skipAcquisition = false;
      if (type === ResourceType.AGENT) {
        const agent = await this.repository.findAgentSystemFlag(resourceId);
        if (agent?.isSystem) skipAcquisition = true;
      }
      if (!skipAcquisition) {
        const owns = await this.repository.findUserResourceAcquisition({
          userId,
          resourceType: type,
          resourceId,
        });
        if (!owns) throw new ForbiddenException('需先获取该资源才能激活到会话');
      }
    }

    const existing = await this.repository.findConversationResource({
      conversationId,
      resourceType: type,
      resourceId,
    });
    if (existing) throw new ConflictException('已激活');

    if (isTemplateResourceType(type)) {
      const existingTemplate =
        await this.repository.findFirstConversationResource(
          conversationId,
          type,
        );
      if (existingTemplate) {
        throw new ConflictException(templateConflictMessage(type));
      }
    }

    if (type === ResourceType.AGENT) {
      const existingAgentRes =
        await this.repository.findFirstConversationResourceId(
          conversationId,
          ResourceType.AGENT,
        );

      if (existingAgentRes) {
        const messageCount = await this.repository.countMessages(conversationId);
        if (messageCount > 0) {
          const [currentAgent, newAgent] = await Promise.all([
            this.repository.findAgentKind(existingAgentRes.resourceId),
            this.repository.findAgentKind(resourceId),
          ]);
          if (
            hasStartedAgentKindConflict({
              messageCount,
              currentAgent,
              newAgent,
            })
          ) {
            throw new BadRequestException(
              '对话已开始，无法切换到不同模式的 Agent。请新建会话切换。',
            );
          }
        }
        throw new ConflictException('会话已关联 Agent，请先移除后再关联');
      }
    }

    const created = await this.repository.createConversationResource({
      conversationId,
      resourceType: type,
      resourceId,
      activatedBy: userId,
    });

    const attachedTemplateKind = conversationKindForAttachedTemplate(type);
    if (attachedTemplateKind) {
      await this.setConversationKind(conversationId, attachedTemplateKind);
    }
    if (type === ResourceType.IMAGE_TEMPLATE) {
      await this.autoSwitchToImageAgent(conversationId, userId);
    }

    return created;
  }

  private async autoSwitchToImageAgent(
    conversationId: string,
    userId: string,
  ) {
    const existingAgentRes =
      await this.repository.findFirstConversationResourceId(
        conversationId,
        ResourceType.AGENT,
      );

    if (existingAgentRes) {
      const agent = await this.repository.findAgentKind(
        existingAgentRes.resourceId,
      );
      if (agent?.kind === 'image') return;

      await this.repository.deleteConversationResource({
        conversationId,
        resourceType: ResourceType.AGENT,
        resourceId: existingAgentRes.resourceId,
      });
    }

    const imageAgent = await this.repository.findFirstSystemSingleAgent(
      AgentKind.image,
    );
    if (imageAgent) {
      await this.repository.createConversationResource({
        conversationId,
        resourceType: ResourceType.AGENT,
        resourceId: imageAgent.id,
        activatedBy: userId,
      });
    }
  }

  async detach(
    userId: string,
    conversationId: string,
    type: ResourceType,
    resourceId: string,
  ) {
    await this.requireOwnConversation(conversationId, userId);
    const result = await this.repository.deleteConversationResource({
      conversationId,
      resourceType: type,
      resourceId,
    });

    if (type === ResourceType.IMAGE_TEMPLATE) {
      await this.autoRestoreChatAgent(conversationId, userId);
      await this.restoreConversationKindFromTemplates(conversationId);
    }
    if (type === ResourceType.VIDEO_TEMPLATE) {
      await this.restoreConversationKindFromTemplates(conversationId);
    }

    return result;
  }

  private async autoRestoreChatAgent(
    conversationId: string,
    userId: string,
  ) {
    const remaining = await this.repository.findFirstConversationResource(
      conversationId,
      ResourceType.IMAGE_TEMPLATE,
    );
    if (remaining) return;

    const agentRes = await this.repository.findFirstConversationResourceId(
      conversationId,
      ResourceType.AGENT,
    );
    if (!agentRes) return;

    const agent = await this.repository.findAgentKindAndSystem(
      agentRes.resourceId,
    );
    if (!agent || agent.kind !== 'image') return;

    await this.repository.deleteConversationResource({
      conversationId,
      resourceType: ResourceType.AGENT,
      resourceId: agentRes.resourceId,
    });

    const chatAgent = await this.repository.findOldestSystemSingleAgent(
      AgentKind.chat,
    );
    if (chatAgent) {
      await this.repository.createConversationResource({
        conversationId,
        resourceType: ResourceType.AGENT,
        resourceId: chatAgent.id,
        activatedBy: userId,
      });
    }
  }

  private async restoreConversationKindFromTemplates(conversationId: string) {
    const videoTemplate = await this.repository.findFirstConversationResource(
      conversationId,
      ResourceType.VIDEO_TEMPLATE,
    );
    if (videoTemplate) {
      await this.setConversationKind(
        conversationId,
        conversationKindFromTemplatePresence({
          hasVideoTemplate: true,
          hasImageTemplate: false,
        }),
      );
      return;
    }

    const imageTemplate = await this.repository.findFirstConversationResource(
      conversationId,
      ResourceType.IMAGE_TEMPLATE,
    );
    await this.setConversationKind(
      conversationId,
      conversationKindFromTemplatePresence({
        hasVideoTemplate: false,
        hasImageTemplate: !!imageTemplate,
      }),
    );
  }

  private async setConversationKind(
    conversationId: string,
    kind: AgentKind,
  ) {
    await this.repository.updateConversationKind(conversationId, kind);
  }

  async list(userId: string, conversationId: string) {
    await this.requireOwnConversation(conversationId, userId);
    const links = await this.repository.findConversationResources(conversationId);
    return this.enrich(links);
  }

  /**
   * 构造会话级资源 system prompt 片段(包含已激活 Skills + Agents)。
   * MCP 不进 prompt,而是挂到工具调用上下文。
   * 同时返回 mcpRefs 供调用方用于工具列表挂载。
   */
  async buildResourcePrompt(conversationId: string): Promise<{
    prompt: string;
    mcpRefs: { id: string; serverName: string; transport: string }[];
  }> {
    const links = await this.repository.findConversationResources(conversationId);

    if (links.length === 0) return { prompt: '', mcpRefs: [] };

    const resources = await this.repository.findPromptResources(
      getPromptResourceIds(links),
    );

    return buildResourcePromptPayload(resources);
  }

  /**
   * 解析消息中的 @resourceType:id 标记,返回拼接的临时 prompt(本条消息生效)
   * 标记示例: @skill:abc123 / @agent:xyz789 / @mcp:foo
   */
  async resolveMentions(userId: string, message: string): Promise<string> {
    const refs = parseMentionRefs(message);
    if (refs.length === 0) return '';

    const sections: string[] = [];

    for (const ref of refs) {
      // 仅允许引用用户已获取的资源
      const acquired = await this.repository.findUserResourceAcquisition({
        userId,
        resourceType: ref.type,
        resourceId: ref.id,
      });
      if (!acquired) continue;

      let section: string | undefined;
      if (ref.type === ResourceType.SKILL) {
        section = formatMentionResourceSection(
          ref.type,
          await this.repository.findSkillMention(ref.id),
        );
      } else if (ref.type === ResourceType.AGENT) {
        section = formatMentionResourceSection(
          ref.type,
          await this.repository.findAgentMention(ref.id),
        );
      } else {
        section = formatMentionResourceSection(
          ref.type,
          await this.repository.findMcpMention(ref.id),
        );
      }
      if (section) sections.push(section);
    }

    return buildMentionPrompt(sections);
  }

  private async requireOwnConversation(
    conversationId: string,
    userId: string,
  ) {
    const conv = await this.repository.findConversationOwner(conversationId);
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问该会话');
  }

  private async enrich(
    links: Array<{
      id: string;
      conversationId: string;
      resourceType: ResourceType;
      resourceId: string;
      activatedAt: Date;
      activatedBy: string;
    }>,
  ) {
    const grouped = groupResourceIdsByType(links);

    const detailMap = new Map<string, unknown>();
    for (const [rawType, ids] of Object.entries(grouped)) {
      const type = rawType as ResourceType;
      if (!ids?.length || !isDetailResourceType(type)) {
        continue;
      }
      const items = await this.repository.findResourceDetailsByType(type, ids);
      addResourceDetailsToMap(detailMap, type, items);
    }

    return attachResourceDetails(links, detailMap);
  }
}
