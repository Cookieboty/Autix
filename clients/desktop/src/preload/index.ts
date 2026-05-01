import { contextBridge, ipcRenderer } from 'electron';

const auth = {
  getAccessToken: () => ipcRenderer.invoke('auth:get-access-token') as Promise<string | null>,
  getRefreshToken: () => ipcRenderer.invoke('auth:get-refresh-token') as Promise<string | null>,
  setTokens: (access: string, refresh: string) =>
    ipcRenderer.invoke('auth:set-tokens', { access, refresh }) as Promise<void>,
  clearTokens: () => ipcRenderer.invoke('auth:clear-tokens') as Promise<void>,
  getUser: () => ipcRenderer.invoke('auth:get-user') as Promise<unknown | null>,
  setUser: (user: unknown) => ipcRenderer.invoke('auth:set-user', user) as Promise<void>,
  getLanguage: () => ipcRenderer.invoke('auth:get-language') as Promise<string | null>,
  setLanguage: (lang: string) => ipcRenderer.invoke('auth:set-language', lang) as Promise<void>,
  getMenus: () => ipcRenderer.invoke('auth:get-menus') as Promise<unknown[]>,
  setMenus: (menus: unknown[]) => ipcRenderer.invoke('auth:set-menus', menus) as Promise<void>,
  getSystems: () => ipcRenderer.invoke('auth:get-systems') as Promise<unknown[]>,
  setSystems: (systems: unknown[]) => ipcRenderer.invoke('auth:set-systems', systems) as Promise<void>,
};

const win = {
  minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  maximize: () => ipcRenderer.invoke('window:maximize') as Promise<void>,
  unmaximize: () => ipcRenderer.invoke('window:unmaximize') as Promise<void>,
  close: () => ipcRenderer.invoke('window:close') as Promise<void>,
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  setFullScreen: (flag: boolean) =>
    ipcRenderer.invoke('window:set-full-screen', flag) as Promise<void>,
  toggleDevTools: () => ipcRenderer.invoke('window:toggle-dev-tools') as Promise<void>,
};

const files = {
  readDropped: (path: string) =>
    ipcRenderer.invoke('files:read-dropped', path) as Promise<{
      name: string;
      type: string;
      data: ArrayBuffer;
    }>,
};

const notify = {
  show: (opts: { title: string; body: string; taskId?: string; route?: string }) =>
    ipcRenderer.invoke('notify:show', opts) as Promise<void>,
};

const updater = {
  onAvailable: (cb: (info: { version: string; releaseUrl: string }) => void) => {
    const handler = (_event: unknown, info: { version: string; releaseUrl: string }) => cb(info);
    ipcRenderer.on('updater:available', handler);
    return () => ipcRenderer.removeListener('updater:available', handler);
  },
  openReleasePage: (url: string) =>
    ipcRenderer.invoke('updater:open-release', url) as Promise<void>,
  checkNow: () => ipcRenderer.invoke('updater:check-now') as Promise<void>,
};

const appApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  getPlatform: () => ipcRenderer.invoke('app:get-platform') as Promise<NodeJS.Platform>,
  on: (channel: string, cb: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('electron', {
  auth,
  window: win,
  files,
  notify,
  updater,
  app: appApi,
});

contextBridge.exposeInMainWorld('__DESKTOP__', true);
