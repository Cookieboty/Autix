import { ArtifactType, ModelType } from '../prisma/generated';
import { ArtifactService } from './artifact.service';

const mockStream = jest.fn(async function* () {
  yield { content: '优化后' };
  yield { content: '内容' };
});

jest.mock('../llm/model.factory', () => ({
  createChatModelFromDbConfig: jest.fn(() => ({
    stream: mockStream,
  })),
}));

function createResponse() {
  return {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
}

function createService() {
  const prisma = {
    artifacts: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'artifact-1',
        conversationId: 'conversation-1',
        userId: 'user-1',
        title: '需求文档',
        type: ArtifactType.MARKDOWN,
        content: '原始内容',
        currentVersion: 2,
        artifact_versions: [
          {
            version: 2,
            content: '原始内容',
            sourcetags: ['AI', 'HUMAN'],
          },
        ],
      }),
      update: jest.fn().mockResolvedValue({ id: 'artifact-1' }),
    },
  };
  const modelConfigService = {
    findDefaultByType: jest.fn().mockResolvedValue({
      id: 'model-1',
      model: 'gpt-4o-mini',
      provider: 'openai-official',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      type: ModelType.general,
      metadata: {},
    }),
  };
  const billing = {
    hold: jest.fn().mockResolvedValue({ holdId: 'hold-1', balance: 985 }),
    confirm: jest.fn(),
    refund: jest.fn(),
  };

  return {
    service: new ArtifactService(
      prisma as never,
      modelConfigService as never,
      billing as never,
    ),
    prisma,
    modelConfigService,
    billing,
  };
}

describe('ArtifactService.optimizeArtifactStream billing', () => {
  beforeEach(() => {
    mockStream.mockClear();
  });

  it('freezes prompt optimization points and confirms them after saving the new version', async () => {
    const { service, prisma, modelConfigService, billing } = createService();
    const res = createResponse();

    await service.optimizeArtifactStream(
      'artifact-1',
      'user-1',
      '补充技术细节',
      res as never,
    );

    expect(modelConfigService.findDefaultByType).toHaveBeenCalledWith(ModelType.general);
    expect(billing.hold).toHaveBeenCalledWith(
      'user-1',
      0,
      expect.objectContaining({
        modelConfigId: 'model-1',
        modelName: 'gpt-4o-mini',
        requirePricing: true,
        remark: 'Artifact 文档 AI 优化 · openai-official/gpt-4o-mini',
        pricing: expect.objectContaining({
          taskType: 'prompt_optimize_pro',
          modelProvider: 'openai-official',
          modelName: 'gpt-4o-mini',
        }),
      }),
    );
    expect(prisma.artifacts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'artifact-1' },
        data: expect.objectContaining({
          content: '优化后内容',
          currentVersion: 3,
        }),
      }),
    );
    expect(billing.confirm).toHaveBeenCalledWith('hold-1');
    expect(billing.refund).not.toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"type":"done"'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('refunds the prompt optimization hold when the stream fails', async () => {
    const { service, prisma, billing } = createService();
    const res = createResponse();
    (
      mockStream as unknown as {
        mockRejectedValueOnce: (error: Error) => void;
      }
    ).mockRejectedValueOnce(new Error('llm failed'));

    await service.optimizeArtifactStream(
      'artifact-1',
      'user-1',
      '补充技术细节',
      res as never,
    );

    expect(prisma.artifacts.update).not.toHaveBeenCalled();
    expect(billing.confirm).not.toHaveBeenCalled();
    expect(billing.refund).toHaveBeenCalledWith('hold-1');
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"type":"error"'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
