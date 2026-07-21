import { describe, expect, it } from 'vitest';
import { folderErrorMessage, nextFolderName } from './asset-folder-name';

describe('nextFolderName', () => {
  it('没有重名时原样返回', () => {
    expect(nextFolderName('New folder', ['test'])).toBe('New folder');
    expect(nextFolderName('New folder', [])).toBe('New folder');
  });

  it('重名时从 2 开始递增——否则第二次点加号必然撞后端 409', () => {
    expect(nextFolderName('New folder', ['New folder'])).toBe('New folder 2');
    expect(nextFolderName('New folder', ['New folder', 'New folder 2'])).toBe('New folder 3');
  });

  it('按小写比对：后端 findActiveByName 是大小写不敏感的', () => {
    // 若这里按大小写敏感判，会挑出「自以为可用、实际仍 409」的名字。
    expect(nextFolderName('New folder', ['NEW FOLDER'])).toBe('New folder 2');
  });

  it('忽略首尾空白后再比对', () => {
    expect(nextFolderName('New folder', ['  New folder  '])).toBe('New folder 2');
  });

  it('中间有空档时填最小的可用序号', () => {
    expect(nextFolderName('New folder', ['New folder', 'New folder 3'])).toBe('New folder 2');
  });
});

describe('folderErrorMessage', () => {
  it('优先读 err.msg —— 本仓库 API 的错误体是 msg 不是 message', () => {
    expect(folderErrorMessage({ msg: '已存在同名文件夹' }, 'fallback')).toBe('已存在同名文件夹');
  });

  it('退而读 response.data.msg', () => {
    expect(
      folderErrorMessage({ response: { data: { msg: '文件夹不存在' } } }, 'fallback'),
    ).toBe('文件夹不存在');
  });

  it('拿不到后端原因才用兜底文案', () => {
    expect(folderErrorMessage({}, 'fallback')).toBe('fallback');
    // message（而非 msg）不该被当成后端原因——那是别的东西塞的
    expect(folderErrorMessage({ response: { data: { message: 'x' } } }, 'fallback')).toBe('fallback');
  });
});
