import { BadRequestException } from '@nestjs/common';
import { type SystemPromptRow } from './system-prompt.repository';
import { SystemPromptService } from './system-prompt.service';

function promptRow(overrides: Partial<SystemPromptRow> = {}): SystemPromptRow {
  return {
    id: 'prompt-1',
    key: 'assistant.general',
    name: 'General',
    description: null,
    version: '1.0.0',
    content: 'Hello {{name}}, {{missing}}',
    variables: ['name'],
    status: 'draft',
    createdAt: new Date('2026-06-16T00:00:00.000Z'),
    updatedAt: new Date('2026-06-16T00:00:00.000Z'),
    publishedAt: null,
    ...overrides,
  };
}

function createService() {
  const repository = {
    ensureTable: jest.fn(async () => undefined),
    findAll: jest.fn(async () => [] as SystemPromptRow[]),
    findById: jest.fn(async () => null as SystemPromptRow | null),
    existsByKeyVersion: jest.fn(async () => false),
    createDraft: jest.fn(
      async (
        input: Pick<SystemPromptRow, 'key' | 'name' | 'description' | 'version' | 'content'> & {
          variables: string[];
        },
      ) => promptRow({ ...input, status: 'draft' }),
    ),
    updateDraft: jest.fn(
      async (
        input: Pick<
          SystemPromptRow,
          'id' | 'name' | 'description' | 'version' | 'content'
        > & {
          variables: string[];
        },
      ) => promptRow({ ...input, status: 'draft' }),
    ),
    publish: jest.fn(async (row: Pick<SystemPromptRow, 'id' | 'key'>) =>
      promptRow({
        id: row.id,
        key: row.key,
        status: 'active',
        publishedAt: new Date('2026-06-16T01:00:00.000Z'),
      }),
    ),
    findActiveByKey: jest.fn(async () => null as SystemPromptRow | null),
  };

  return {
    service: new SystemPromptService(repository as never),
    repository,
  };
}

describe('SystemPromptService', () => {
  it('renders active database prompts and keeps missing variables intact', async () => {
    const { service, repository } = createService();
    repository.findActiveByKey.mockResolvedValue(promptRow({ status: 'active' }));

    await expect(service.render('assistant.general', { name: 'Autix' })).resolves.toMatchObject({
      key: 'assistant.general',
      source: 'database',
      content: 'Hello Autix, {{missing}}',
      variables: ['name'],
    });
    expect(repository.ensureTable).toHaveBeenCalled();
    expect(repository.findActiveByKey).toHaveBeenCalledWith('assistant.general');
  });

  it('falls back to default prompts when no active database prompt exists', async () => {
    const { service, repository } = createService();

    await expect(service.render('assistant.general', { language: 'zh-CN' })).resolves.toMatchObject({
      key: 'assistant.general',
      source: 'default',
      version: '1.0.0',
    });
    expect(repository.findActiveByKey).toHaveBeenCalledWith('assistant.general');
  });

  it('rejects duplicate prompt versions before creating drafts', async () => {
    const { service, repository } = createService();
    repository.existsByKeyVersion.mockResolvedValue(true);

    await expect(
      service.createDraft({
        key: 'assistant.general',
        name: 'General',
        version: '1.0.0',
        content: 'Hello',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it('allows edits only for draft prompts', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(promptRow({ status: 'active' }));

    await expect(service.updateDraft('prompt-1', { content: 'Updated' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });
});
