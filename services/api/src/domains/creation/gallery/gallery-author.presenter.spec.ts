import { presentAuthor } from './gallery-author.presenter';

/**
 * Plan C Task 7：作者 presenter 单元测试（纯函数）。
 * - ACTIVE：nickname = displayName ?? username；avatar 原样透出。
 * - DELETED：昵称固定 '已注销用户'、avatar=null，且绝不泄漏 username（含 deleted_ 前缀）
 *   或任何 PII——只回传 userId（本就是帖子的 authorId，调用方已知）。
 *
 * 前向兼容：status 类型为 string，'DELETED' 分支今日即可编译并被测试覆盖，
 * 待 account 分支给 UserStatus 补上 DELETED 后自动生效。
 */
describe('presentAuthor', () => {
  it('ACTIVE：displayName 存在 → nickname=displayName，avatar 原样', () => {
    expect(
      presentAuthor({
        id: 'u1',
        status: 'ACTIVE',
        displayName: 'Amy',
        username: 'amy',
        avatar: 'a.png',
      }),
    ).toEqual({ userId: 'u1', nickname: 'Amy', avatar: 'a.png' });
  });

  it('ACTIVE：displayName 为 null → 回退到 username，avatar 可为 null', () => {
    expect(
      presentAuthor({
        id: 'u2',
        status: 'ACTIVE',
        displayName: null,
        username: 'bob',
        avatar: null,
      }),
    ).toEqual({ userId: 'u2', nickname: 'bob', avatar: null });
  });

  it('DELETED：昵称=已注销用户、avatar=null，不泄漏 deleted_ 前缀 username', () => {
    const out = presentAuthor({
      id: 'u3',
      status: 'DELETED',
      displayName: null,
      username: 'deleted_u3',
      avatar: 'stale-avatar.png',
    });
    expect(out).toEqual({ userId: 'u3', nickname: '已注销用户', avatar: null });
    // 隐私铁律：序列化输出里绝不能出现原始 username / deleted_ 前缀 / 旧头像
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('deleted_');
    expect(serialized).not.toContain('deleted_u3');
    expect(serialized).not.toContain('stale-avatar');
  });
});
