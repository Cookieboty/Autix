import { AgentKind, ResourceType } from '../../platform/prisma/generated';
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
  resourceDetailKey,
  templateConflictMessage,
} from './conversation-resources.helpers';

describe('conversation resource helpers', () => {
  it('classifies resource types and conversation kind decisions', () => {
    expect(isActivatableResourceType(ResourceType.SKILL)).toBe(true);
    expect(isActivatableResourceType(ResourceType.IMAGE_TEMPLATE)).toBe(true);
    expect(isActivatableResourceType('UNKNOWN' as ResourceType)).toBe(false);

    expect(requiresResourceAcquisition(ResourceType.AGENT)).toBe(true);
    expect(requiresResourceAcquisition(ResourceType.IMAGE_TEMPLATE)).toBe(false);

    expect(isTemplateResourceType(ResourceType.IMAGE_TEMPLATE)).toBe(true);
    expect(isTemplateResourceType(ResourceType.VIDEO_TEMPLATE)).toBe(true);
    expect(isTemplateResourceType(ResourceType.SKILL)).toBe(false);

    expect(isDetailResourceType(ResourceType.MCP)).toBe(true);
    expect(isDetailResourceType('UNKNOWN' as ResourceType)).toBe(false);

    expect(templateConflictMessage(ResourceType.IMAGE_TEMPLATE)).toBe(
      '会话已关联图片模板，请先移除后再关联',
    );
    expect(templateConflictMessage(ResourceType.VIDEO_TEMPLATE)).toBe(
      '会话已关联视频模板，请先移除后再关联',
    );

    expect(conversationKindForAttachedTemplate(ResourceType.IMAGE_TEMPLATE)).toBe(
      AgentKind.image,
    );
    expect(conversationKindForAttachedTemplate(ResourceType.VIDEO_TEMPLATE)).toBe(
      AgentKind.video,
    );
    expect(conversationKindForAttachedTemplate(ResourceType.AGENT)).toBeUndefined();

    expect(
      conversationKindFromTemplatePresence({
        hasVideoTemplate: true,
        hasImageTemplate: true,
      }),
    ).toBe(AgentKind.video);
    expect(
      conversationKindFromTemplatePresence({
        hasVideoTemplate: false,
        hasImageTemplate: true,
      }),
    ).toBe(AgentKind.image);
    expect(
      conversationKindFromTemplatePresence({
        hasVideoTemplate: false,
        hasImageTemplate: false,
      }),
    ).toBe(AgentKind.chat);
  });

  it('detects agent kind conflicts only after a conversation has messages', () => {
    expect(
      hasStartedAgentKindConflict({
        messageCount: 1,
        currentAgent: { kind: AgentKind.chat },
        newAgent: { kind: AgentKind.image },
      }),
    ).toBe(true);
    expect(
      hasStartedAgentKindConflict({
        messageCount: 0,
        currentAgent: { kind: AgentKind.chat },
        newAgent: { kind: AgentKind.image },
      }),
    ).toBe(false);
    expect(
      hasStartedAgentKindConflict({
        messageCount: 1,
        currentAgent: { kind: AgentKind.image },
        newAgent: { kind: AgentKind.image },
      }),
    ).toBe(false);
    expect(
      hasStartedAgentKindConflict({
        messageCount: 1,
        currentAgent: null,
        newAgent: { kind: AgentKind.image },
      }),
    ).toBe(false);
  });

  it('extracts prompt resource ids and renders the prompt payload', () => {
    const links = [
      { resourceType: ResourceType.SKILL, resourceId: 'skill-1' },
      { resourceType: ResourceType.AGENT, resourceId: 'agent-1' },
      { resourceType: ResourceType.MCP, resourceId: 'mcp-1' },
      { resourceType: ResourceType.IMAGE_TEMPLATE, resourceId: 'image-tpl-1' },
      { resourceType: ResourceType.VIDEO_TEMPLATE, resourceId: 'video-tpl-1' },
      { resourceType: ResourceType.SKILL, resourceId: 'skill-2' },
    ];

    expect(getPromptResourceIds(links)).toEqual({
      skillIds: ['skill-1', 'skill-2'],
      agentIds: ['agent-1'],
      mcpIds: ['mcp-1'],
      imageTemplateIds: ['image-tpl-1'],
      videoTemplateIds: ['video-tpl-1'],
    });

    const mcpRefs = [
      { id: 'mcp-1', serverName: 'filesystem', transport: 'stdio' },
    ];
    const result = buildResourcePromptPayload({
      skills: [{ title: 'Skill One', instructions: 'Use the skill.' }],
      agents: [{ title: 'Agent One', systemPrompt: 'Act as agent.' }],
      mcps: mcpRefs,
      imageTemplates: [
        {
          title: 'Product Image',
          prompt: 'Create a {{style}} image',
          variables: [{ key: 'style', default: 'modern' }],
          modelHint: 'gpt-image-2',
        },
      ],
      videoTemplates: [
        {
          title: 'Launch Video',
          prompt: 'Create a video',
          variables: null,
        },
      ],
    });

    expect(result.mcpRefs).toBe(mcpRefs);
    expect(result.prompt).toContain('### 会话已激活资源(请遵循以下指令)');
    expect(result.prompt).toContain('## Skill: Skill One\nUse the skill.');
    expect(result.prompt).toContain('## Agent: Agent One\nAct as agent.');
    expect(result.prompt).toContain('## Image Template: Product Image');
    expect(result.prompt).toContain('Preferred Image Model: gpt-image-2');
    expect(result.prompt).toContain('"style"');
    expect(result.prompt).toContain('## Video Template: Launch Video');
    expect(result.prompt).toContain('Variables:\n[]');
    expect(result.prompt).not.toContain('Preferred Video Model');
  });

  it('parses and formats one-shot mention prompt sections', () => {
    expect(
      parseMentionRefs(
        'Try @Skill:ABC_1 then @agent:agent-2 and @mcp:server_name.',
      ),
    ).toEqual([
      { type: ResourceType.SKILL, id: 'ABC_1' },
      { type: ResourceType.AGENT, id: 'agent-2' },
      { type: ResourceType.MCP, id: 'server_name' },
    ]);

    const sections = [
      formatMentionResourceSection(ResourceType.SKILL, {
        title: 'Drafting',
        instructions: 'Write tightly.',
      }),
      formatMentionResourceSection(ResourceType.AGENT, {
        title: 'Planner',
        systemPrompt: 'Plan first.',
      }),
      formatMentionResourceSection(ResourceType.MCP, {
        title: 'Files',
        serverName: 'filesystem',
        transport: 'stdio',
      }),
      formatMentionResourceSection(ResourceType.SKILL, null),
    ].filter((section): section is string => !!section);

    expect(buildMentionPrompt(sections)).toBe(
      [
        '### 本条消息引用的资源(仅本次生效)',
        '',
        '## @Skill: Drafting',
        'Write tightly.',
        '',
        '## @Agent: Planner',
        'Plan first.',
        '',
        '## @MCP: Files (filesystem, stdio)',
      ].join('\n'),
    );
    expect(buildMentionPrompt([])).toBe('');
  });

  it('groups resource links and attaches detail records by resource key', () => {
    const links = [
      {
        id: 'link-1',
        conversationId: 'conv-1',
        resourceType: ResourceType.SKILL,
        resourceId: 'skill-1',
      },
      {
        id: 'link-2',
        conversationId: 'conv-1',
        resourceType: ResourceType.SKILL,
        resourceId: 'missing',
      },
      {
        id: 'link-3',
        conversationId: 'conv-1',
        resourceType: ResourceType.AGENT,
        resourceId: 'agent-1',
      },
    ];

    expect(groupResourceIdsByType(links)).toEqual({
      [ResourceType.SKILL]: ['skill-1', 'missing'],
      [ResourceType.AGENT]: ['agent-1'],
    });

    const detailMap = new Map<string, unknown>();
    addResourceDetailsToMap(detailMap, ResourceType.SKILL, [
      { id: 'skill-1', title: 'Skill One' },
    ]);
    addResourceDetailsToMap(detailMap, ResourceType.AGENT, [
      { id: 'agent-1', title: 'Agent One' },
    ]);

    expect(resourceDetailKey(ResourceType.SKILL, 'skill-1')).toBe(
      `${ResourceType.SKILL}:skill-1`,
    );
    expect(attachResourceDetails(links, detailMap)).toEqual([
      {
        ...links[0],
        resource: { id: 'skill-1', title: 'Skill One' },
      },
      {
        ...links[1],
        resource: undefined,
      },
      {
        ...links[2],
        resource: { id: 'agent-1', title: 'Agent One' },
      },
    ]);
  });
});
