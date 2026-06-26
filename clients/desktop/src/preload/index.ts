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
  startOAuth: (input: { provider: string; apiBaseUrl: string; systemCode: string; inviteCode?: string }) =>
    ipcRenderer.invoke('auth:start-oauth', input) as Promise<{ code?: string; error?: string }>,
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

type ResourceType = 'SKILL' | 'MCP' | 'AGENT';

const resources = {
  install: (input: { type: ResourceType; id: string; payload: unknown }) =>
    ipcRenderer.invoke('resource:install', input) as Promise<{
      ok: true;
      path: string;
    }>,
  uninstall: (input: { type: ResourceType; id: string }) =>
    ipcRenderer.invoke('resource:uninstall', input) as Promise<{ ok: true }>,
  listInstalled: () =>
    ipcRenderer.invoke('resource:list-installed') as Promise<
      Array<{
        type: ResourceType;
        id: string;
        path: string;
        manifest?: Record<string, unknown>;
      }>
    >,
  status: (input: { type: ResourceType; id: string }) =>
    ipcRenderer.invoke('resource:status', input) as Promise<{
      status: 'not_installed' | 'missing_env' | 'ready' | 'failed';
      path?: string;
      missingEnv?: string[];
    }>,
  openFolder: (input?: { type?: ResourceType; id?: string }) =>
    ipcRenderer.invoke('resource:open-folder', input ?? {}) as Promise<{
      ok: true;
      path: string;
    }>,
};

contextBridge.exposeInMainWorld('electron', {
  auth,
  window: win,
  files,
  notify,
  updater,
  app: appApi,
});

contextBridge.exposeInMainWorld('amux', {
  resources,
});

contextBridge.exposeInMainWorld('__DESKTOP__', true);
