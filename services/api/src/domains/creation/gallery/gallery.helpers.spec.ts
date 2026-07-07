import { assertSource, assertTransition } from './gallery.helpers';

describe('assertTransition (§5.1.1 状态机)', () => {
  it('作者可 DRAFT→PENDING、REJECTED→PENDING', () => {
    expect(() => assertTransition('DRAFT', 'PENDING', 'author')).not.toThrow();
    expect(() =>
      assertTransition('REJECTED', 'PENDING', 'author'),
    ).not.toThrow();
  });

  it('仅管理员可 PENDING→PUBLISHED；作者不行', () => {
    expect(() =>
      assertTransition('PENDING', 'PUBLISHED', 'admin'),
    ).not.toThrow();
    expect(() => assertTransition('PENDING', 'PUBLISHED', 'author')).toThrow();
  });

  it('系统风控与管理员可 PENDING→REJECTED、PUBLISHED→HIDDEN', () => {
    expect(() =>
      assertTransition('PENDING', 'REJECTED', 'system'),
    ).not.toThrow();
    expect(() =>
      assertTransition('PUBLISHED', 'HIDDEN', 'system'),
    ).not.toThrow();
  });

  it('非法转移抛错（如 PUBLISHED→PENDING）', () => {
    expect(() => assertTransition('PUBLISHED', 'PENDING', 'admin')).toThrow();
  });

  it('I5：作者可删除自己尚未发布的 DRAFT/PENDING/REJECTED 作品', () => {
    expect(() => assertTransition('DRAFT', 'REMOVED', 'author')).not.toThrow();
    expect(() => assertTransition('PENDING', 'REMOVED', 'author')).not.toThrow();
    expect(() => assertTransition('REJECTED', 'REMOVED', 'author')).not.toThrow();
  });
});

describe('assertSource (§6.4 来源强校验)', () => {
  it('USER_UPLOAD：必须有 mediaUrls，且不带模板/生成引用', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'USER_UPLOAD', mediaUrls: ['a.png'] },
        'author',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'USER_UPLOAD',
          mediaUrls: ['a.png'],
          imageTemplateId: 't1',
        },
        'author',
      ),
    ).toThrow();
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'USER_UPLOAD' }, 'author'),
    ).toThrow();
  });

  it('FROM_GENERATION：需与 kind 一致的单一 generationId', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'FROM_GENERATION',
          imageGenerationId: 'g1',
        },
        'author',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'FROM_GENERATION',
          videoGenerationId: 'g1',
        },
        'author',
      ),
    ).toThrow();
  });

  it('M1：FROM_GENERATION 不允许携带模板引用（与 FROM_TEMPLATE 对称）', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'FROM_GENERATION',
          imageGenerationId: 'g1',
          imageTemplateId: 't1',
        },
        'author',
      ),
    ).toThrow();
  });

  it('FROM_TEMPLATE：需模板引用、禁生成引用', () => {
    expect(() =>
      assertSource(
        { kind: 'VIDEO', sourceType: 'FROM_TEMPLATE', videoTemplateId: 't1' },
        'author',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'VIDEO',
          sourceType: 'FROM_TEMPLATE',
          videoTemplateId: 't1',
          videoGenerationId: 'g1',
        },
        'author',
      ),
    ).toThrow();
  });

  it('ADMIN_CURATED：仅管理员', () => {
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'ADMIN_CURATED' }, 'admin'),
    ).not.toThrow();
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'ADMIN_CURATED' }, 'author'),
    ).toThrow();
  });

  it('M1：未知 sourceType 兜底抛错（default 分支）', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'UNKNOWN' as never },
        'author',
      ),
    ).toThrow();
  });
});
