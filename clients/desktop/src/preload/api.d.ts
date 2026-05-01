/**
 * window.electron API 类型定义。preload 通过 contextBridge 暴露这些方法。
 */

export interface DesktopAuthApi {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(access: string, refresh: string): Promise<void>;
  clearTokens(): Promise<void>;
  getUser(): Promise<unknown | null>;
  setUser(user: unknown): Promise<void>;
  getLanguage(): Promise<string | null>;
  setLanguage(lang: string): Promise<void>;
  getMenus(): Promise<unknown[]>;
  setMenus(menus: unknown[]): Promise<void>;
  getSystems(): Promise<unknown[]>;
  setSystems(systems: unknown[]): Promise<void>;
}

export interface DesktopWindowApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  setFullScreen(flag: boolean): Promise<void>;
  toggleDevTools(): Promise<void>;
}

export interface DesktopFilesApi {
  /** 读取拖拽文件路径，返回 ArrayBuffer */
  readDropped(path: string): Promise<{ name: string; type: string; data: ArrayBuffer }>;
}

export interface DesktopNotifyApi {
  show(opts: { title: string; body: string; taskId?: string; route?: string }): Promise<void>;
}

export interface DesktopUpdaterApi {
  onAvailable(cb: (info: { version: string; releaseUrl: string }) => void): () => void;
  openReleasePage(url: string): Promise<void>;
  checkNow(): Promise<void>;
}

export interface DesktopAppApi {
  getVersion(): Promise<string>;
  getPlatform(): Promise<NodeJS.Platform>;
  /** 监听主进程通过 webContents.send 推送的事件（deep-link、shortcut 等） */
  on(channel: 'deep-link:navigate' | 'shortcut:new-chat' | 'shortcut:focus', cb: (payload: unknown) => void): () => void;
}

declare global {
  interface Window {
    electron: {
      auth: DesktopAuthApi;
      window: DesktopWindowApi;
      files: DesktopFilesApi;
      notify: DesktopNotifyApi;
      updater: DesktopUpdaterApi;
      app: DesktopAppApi;
    };
    /** 标记当前运行环境为桌面端（渲染层 feature-detect 用） */
    __DESKTOP__: boolean;
  }
}

export {};
