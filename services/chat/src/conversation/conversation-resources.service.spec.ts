import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ResourceType } from '@prisma/client';
import { ConversationResourcesService } from './conversation-resources.service';

function createPrismaMock() {
  return {
    conversations: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    },
    user_resource_acquisitions: {
      findUnique: jest.fn(),
    },
    conversation_resources: {
      create: jest.fn().mockResolvedValue({ id: 'link-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    skills: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    agents: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    mcp_servers: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    image_templates: {
      findMany: jest.fn(),
    },
    video_templates: {
      findMany: jest.fn(),
    },
  };
}

describe('ConversationResourcesService', () => {
  it('attaches image templates without requiring acquisition', async () => {
    const prisma = createPrismaMock();
    const service = new ConversationResourcesService(prisma as never);

    await service.attach(
      'user-1',
      'conv-1',
      ResourceType.IMAGE_TEMPLATE,
      'tpl-1',
    );

    expect(prisma.user_resource_acquisitions.findUnique).not.toHaveBeenCalled();
    expect(prisma.conversation_resources.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
        activatedBy: 'user-1',
      },
    });
  });

  it('rejects attaching a second image template to the same conversation', async () => {
    const prisma = createPrismaMock();
    prisma.conversation_resources.findFirst.mockResolvedValue({
      id: 'existing-link',
      conversationId: 'conv-1',
      resourceType: ResourceType.IMAGE_TEMPLATE,
      resourceId: 'tpl-existing',
    });
    const service = new ConversationResourcesService(prisma as never);

    await expect(
      service.attach(
        'user-1',
        'conv-1',
        ResourceType.IMAGE_TEMPLATE,
        'tpl-new',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.conversation_resources.create).not.toHaveBeenCalled();
  });

  it('still requires acquisition for skills', async () => {
    const prisma = createPrismaMock();
    prisma.user_resource_acquisitions.findUnique.mockResolvedValue(null);
    const service = new ConversationResourcesService(prisma as never);

    await expect(
      service.attach('user-1', 'conv-1', ResourceType.SKILL, 'skill-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enriches image template resource links', async () => {
    const prisma = createPrismaMock();
    prisma.conversation_resources.findMany.mockResolvedValue([
      {
        id: 'link-1',
        conversationId: 'conv-1',
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
        activatedAt: new Date('2026-01-01T00:00:00.000Z'),
        activatedBy: 'user-1',
      },
    ]);
    prisma.image_templates.findMany.mockResolvedValue([
      { id: 'tpl-1', title: '商品图模板', category: 'product' },
    ]);
    const service = new ConversationResourcesService(prisma as never);

    const result = await service.list('user-1', 'conv-1');

    expect(result[0].resource).toMatchObject({
      id: 'tpl-1',
      title: '商品图模板',
    });
  });

  it('includes image template details in resource prompt', async () => {
    const prisma = createPrismaMock();
    prisma.conversation_resources.findMany.mockResolvedValue([
      {
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
      },
    ]);
    prisma.image_templates.findMany.mockResolvedValue([
      {
        id: 'tpl-1',
        title: '商品图模板',
        prompt: 'Create a {{style}} product image',
        variables: [{ key: 'style', label: 'Style', default: 'modern' }],
        modelHint: 'gpt-image-2',
      },
    ]);
    const service = new ConversationResourcesService(prisma as never);

    const result = await service.buildResourcePrompt('conv-1');

    expect(result.prompt).toContain('Image Template: 商品图模板');
    expect(result.prompt).toContain('Create a {{style}} product image');
    expect(result.prompt).toContain('"style"');
  });

  it('rejects unsupported resource types', async () => {
    const prisma = createPrismaMock();
    const service = new ConversationResourcesService(prisma as never);

    await expect(
      service.attach(
        'user-1',
        'conv-1',
        'UNKNOWN' as ResourceType,
        'resource-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
