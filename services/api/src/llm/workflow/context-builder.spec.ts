import { buildStepContext, type ContextBuilderDeps } from './context-builder';

function createDeps(libraryEnabled?: boolean): ContextBuilderDeps {
  return {
    libraryEnabled,
    searchService: {
      similaritySearch: jest.fn(),
    } as never,
    prisma: {
      workflow_step_artifacts: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      conversation_resources: {
        findMany: jest.fn().mockResolvedValue([]),
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
    } as never,
  };
}

const baseOpts = {
  conversationId: 'conv-1',
  userId: 'user-1',
  userInput: '查一下我的资料',
  promptTemplate: '用户输入：{{userInput}}',
  inputArtifactKeys: [],
  runId: 'run-1',
};

describe('buildStepContext', () => {
  it('registers the document search tool when library is enabled by default', async () => {
    const context = await buildStepContext(createDeps(), baseOpts);

    expect(context.tools.map((tool) => tool.name)).toContain('search_user_documents');
  });

  it('does not register the document search tool when library is disabled', async () => {
    const context = await buildStepContext(createDeps(false), baseOpts);

    expect(context.tools.map((tool) => tool.name)).not.toContain('search_user_documents');
  });
});
