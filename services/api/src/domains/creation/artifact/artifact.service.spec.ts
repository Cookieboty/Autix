import { ArtifactType, ModelType } from '../../platform/prisma/generated';
import { ArtifactService } from './artifact.service';

// vi.mock is hoisted above this module's bindings, so its factory cannot close
// over a plain const — vi.hoisted lifts the spy up with it.
const { mockStream } = vi.hoisted(() => ({
  mockStream: vi.fn(async function* () {
    yield { content: '优化后' };
    yield { content: '内容' };
  }),
}));

vi.mock('../llm/model.factory', () => ({
  createChatModelFromDbConfig: vi.fn(() => ({
    stream: mockStream,
  })),
}));

function createResponse() {
  return {
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
}

function createService() {
  const artifactRepository = {
    findByIdWithLatestVersion: vi.fn().mockResolvedValue({
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
    updateArtifactWithVersion: vi.fn().mockResolvedValue({ id: 'artifact-1' }),
  };
  const modelConfigService = {
    findDefaultByType: vi.fn().mockResolvedValue({
      id: 'model-1',
      model: 'gpt-4o-mini',
      provider: 'openai-official',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      type: ModelType.general,
      metadata: {},
    }),
    findDefaultByTypeForUser: vi.fn().mockResolvedValue({
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
    hold: vi.fn().mockResolvedValue({ holdId: 'hold-1', balance: 985 }),
    confirm: vi.fn(),
    refund: vi.fn(),
  };

  return {
    service: new ArtifactService(
      artifactRepository as never,
      modelConfigService as never,
      billing as never,
    ),
    artifactRepository,
    modelConfigService,
    billing,
  };
}

describe('ArtifactService.optimizeArtifactStream billing', () => {
  beforeEach(() => {
    mockStream.mockClear();
  });

  it('freezes prompt optimization points and confirms them after saving the new version', async () => {
    const { service, artifactRepository, modelConfigService, billing } = createService();
    const res = createResponse();

    await service.optimizeArtifactStream(
      'artifact-1',
      'user-1',
      '补充技术细节',
      res as never,
    );

    expect(modelConfigService.findDefaultByTypeForUser).toHaveBeenCalledWith(
      ModelType.general,
      'user-1',
    );
    expect(billing.hold).toHaveBeenCalledWith(
      'user-1',
      0,
      expect.objectContaining({
        modelConfigId: 'model-1',
        modelName: 'gpt-4o-mini',
        requirePricing: true,
        remark: 'Artifact document AI optimization · openai-official/gpt-4o-mini',
        pricing: expect.objectContaining({
          taskType: 'prompt_optimize_pro',
          modelProvider: 'openai-official',
          modelName: 'gpt-4o-mini',
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
        }),
      }),
    );
    expect(artifactRepository.updateArtifactWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'artifact-1',
        content: '优化后内容',
        currentVersion: 3,
      }),
    );
    expect(billing.confirm).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({
        taskType: 'prompt_optimize_pro',
        modelProvider: 'openai-official',
        modelName: 'gpt-4o-mini',
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
      }),
    );
    expect(billing.refund).not.toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"type":"done"'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('refunds the prompt optimization hold when the stream fails', async () => {
    const { service, artifactRepository, billing } = createService();
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

    expect(artifactRepository.updateArtifactWithVersion).not.toHaveBeenCalled();
    expect(billing.confirm).not.toHaveBeenCalled();
    expect(billing.refund).toHaveBeenCalledWith('hold-1');
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"type":"error"'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
