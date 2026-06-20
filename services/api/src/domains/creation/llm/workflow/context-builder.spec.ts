import { buildStepContext, type ContextBuilderDeps } from './context-builder';

function createDeps(libraryEnabled?: boolean): ContextBuilderDeps {
  return {
    libraryEnabled,
    searchService: {
      similaritySearch: jest.fn(),
    } as never,
    repository: {
      findLatestWorkflowStepArtifacts: jest.fn().mockResolvedValue([]),
      findConversationResources: jest.fn().mockResolvedValue([]),
      findSkillsByIds: jest.fn().mockResolvedValue([]),
      findSingleAgentsByIds: jest.fn().mockResolvedValue([]),
      findMcpServersByIds: jest.fn().mockResolvedValue([]),
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
