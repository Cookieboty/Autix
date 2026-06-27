import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());

vi.mock('@autix/sdk', () => ({
  materialFoldersApi: {
    list: listMock,
    create: createMock,
    update: vi.fn(),
    remove: vi.fn(),
  },
  materialsApi: { batchMove: vi.fn() },
}));

import { useMaterialFolderStore } from './material-folder.store';

describe('material-folder.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({
      data: {
        folders: [
          {
            id: 'f1',
            userId: 'u1',
            name: 'A',
            sortOrder: 0,
            assetCount: 2,
            createdAt: '',
            updatedAt: '',
          },
        ],
        totalAssetCount: 2,
        rootAssetCount: 0,
      },
    });
    createMock.mockResolvedValue({
      data: { id: 'f2', userId: 'u1', name: 'B', sortOrder: 0, assetCount: 0, createdAt: '', updatedAt: '' },
    });
    useMaterialFolderStore.setState({ sidebar: null, activeFolderId: 'all', loading: false });
  });

  it('loadFolders 写入 sidebar', async () => {
    await useMaterialFolderStore.getState().loadFolders();
    expect(useMaterialFolderStore.getState().sidebar?.folders[0].name).toBe('A');
  });

  it('setActiveFolder 更新 activeFolderId', () => {
    useMaterialFolderStore.getState().setActiveFolder('f1');
    expect(useMaterialFolderStore.getState().activeFolderId).toBe('f1');
  });

  it('createFolder 后刷新文件夹列表', async () => {
    await useMaterialFolderStore.getState().createFolder('B');
    expect(createMock).toHaveBeenCalledWith({ name: 'B' });
    expect(listMock).toHaveBeenCalled();
  });
});
