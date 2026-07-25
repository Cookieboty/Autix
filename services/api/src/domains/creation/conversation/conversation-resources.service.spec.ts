import { AgentKind, ResourceType } from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { ConversationResourcesService } from './conversation-resources.service';

function createRepositoryMock() {
  return {
    countMessages: vi.fn().mockResolvedValue(0),
    createConversationResource: vi.fn().mockResolvedValue({ id: 'link-1' }),
    deleteConversationResource: vi.fn().mockResolvedValue({ id: 'deleted-link' }),
    findAgentKind: vi.fn().mockResolvedValue(null),
    findAgentKindAndSystem: vi.fn().mockResolvedValue(null),
    findAgentSystemFlag: vi.fn().mockResolvedValue(null),
    findConversationOwner: vi.fn().mockResolvedValue({ userId: 'user-1' }),
    findConversationResource: vi.fn().mockResolvedValue(null),
    findConversationResources: vi.fn().mockResolvedValue([]),
    findFirstConversationResource: vi.fn().mockResolvedValue(null),
    findFirstConversationResourceId: vi.fn().mockResolvedValue(null),
    findFirstSystemSingleAgent: vi.fn().mockResolvedValue(null),
    findOldestSystemSingleAgent: vi.fn().mockResolvedValue(null),
    findPromptResources: vi.fn().mockResolvedValue({
      skills: [],
      agents: [],
      mcps: [],
      imageTemplates: [],
      videoTemplates: [],
    }),
    findResourceDetailsByType: vi.fn().mockResolvedValue([]),
    findUserResourceAcquisition: vi.fn(),
    updateConversationKind: vi.fn().mockResolvedValue({ id: 'conv-1' }),
  };
}

describe('ConversationResourcesService', () => {
  it('attaches image templates without requiring acquisition', async () => {
    const repository = createRepositoryMock();
    const service = new ConversationResourcesService(repository as never);

    await service.attach(
      'user-1',
      'conv-1',
      ResourceType.IMAGE_TEMPLATE,
      'tpl-1',
    );

    expect(repository.findUserResourceAcquisition).not.toHaveBeenCalled();
    expect(repository.createConversationResource).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      resourceType: ResourceType.IMAGE_TEMPLATE,
      resourceId: 'tpl-1',
      activatedBy: 'user-1',
    });
    expect(repository.updateConversationKind).toHaveBeenCalledWith(
      'conv-1',
      AgentKind.image,
    );
  });

  it('rejects attaching a second image template to the same conversation', async () => {
    const repository = createRepositoryMock();
    repository.findFirstConversationResource.mockResolvedValue({
      id: 'existing-link',
      conversationId: 'conv-1',
      resourceType: ResourceType.IMAGE_TEMPLATE,
      resourceId: 'tpl-existing',
    });
    const service = new ConversationResourcesService(repository as never);

    await expect(
      service.attach(
        'user-1',
        'conv-1',
        ResourceType.IMAGE_TEMPLATE,
        'tpl-new',
      ),
    ).rejects.toMatchObject({
      status: 409,
      i18nKey: 'creation.conversation.image_template_already_linked',
    });

    expect(repository.createConversationResource).not.toHaveBeenCalled();
  });

  it('still requires acquisition for skills', async () => {
    const repository = createRepositoryMock();
    repository.findUserResourceAcquisition.mockResolvedValue(null);
    const service = new ConversationResourcesService(repository as never);

    await expect(
      service.attach('user-1', 'conv-1', ResourceType.SKILL, 'skill-1'),
    ).rejects.toMatchObject({
      status: 403,
      i18nKey: 'creation.conversation.resource_not_acquired',
    });
  });

  it('enriches image template resource links', async () => {
    const repository = createRepositoryMock();
    repository.findConversationResources.mockResolvedValue([
      {
        id: 'link-1',
        conversationId: 'conv-1',
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
        activatedAt: new Date('2026-01-01T00:00:00.000Z'),
        activatedBy: 'user-1',
      },
    ]);
    repository.findResourceDetailsByType.mockResolvedValue([
      { id: 'tpl-1', title: '商品图模板', category: 'product' },
    ]);
    const service = new ConversationResourcesService(repository as never);

    const result = await service.list('user-1', 'conv-1');

    expect(result[0].resource).toMatchObject({
      id: 'tpl-1',
      title: '商品图模板',
    });
    expect(repository.findResourceDetailsByType).toHaveBeenCalledWith(
      ResourceType.IMAGE_TEMPLATE,
      ['tpl-1'],
    );
  });

  it('includes image template details in resource prompt', async () => {
    const repository = createRepositoryMock();
    repository.findConversationResources.mockResolvedValue([
      {
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
      },
    ]);
    repository.findPromptResources.mockResolvedValue({
      skills: [],
      agents: [],
      mcps: [],
      imageTemplates: [
        {
          id: 'tpl-1',
          title: '商品图模板',
          prompt: 'Create a {{style}} product image',
          variables: [{ key: 'style', label: 'Style', default: 'modern' }],
          modelHint: 'gpt-image-2',
        },
      ],
      videoTemplates: [],
    });
    const service = new ConversationResourcesService(repository as never);

    const result = await service.buildResourcePrompt('conv-1');

    expect(result.prompt).toContain('Image Template: 商品图模板');
    expect(result.prompt).toContain('Create a {{style}} product image');
    expect(result.prompt).toContain('"style"');
  });

  it('rejects unsupported resource types', async () => {
    const repository = createRepositoryMock();
    const service = new ConversationResourcesService(repository as never);

    await expect(
      service.attach(
        'user-1',
        'conv-1',
        'UNKNOWN' as ResourceType,
        'resource-1',
      ),
    ).rejects.toMatchObject({
      status: 400,
      i18nKey: 'creation.conversation.resource_type_not_activatable',
    });
  });
});
