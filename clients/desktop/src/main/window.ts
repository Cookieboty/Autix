import { BrowserWindow, app, nativeImage, screen } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import log from 'electron-log/main';

/**
 * 应用图标路径解析：
 * - dev: 项目里的 resources/icon.png
 * - prod (打包): 由 electron-builder 写入 process.resourcesPath/icon.png
 */
function resolveIconPath(): string | undefined {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../resources/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png'),
  ];
  return candidates.find((p) => existsSync(p));
}

let _mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return _mainWindow && !_mainWindow.isDestroyed() ? _mainWindow : null;
}

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

const DEFAULT_STATE: WindowState = { width: 1440, height: 900 };

function getStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const path = getStatePath();
    if (!existsSync(path)) return DEFAULT_STATE;
    const raw = readFileSync(path, 'utf8');
    const state = JSON.parse(raw) as WindowState;
    // 校验目标显示器是否还在（防止外接屏拔了，窗口飘到不可见区域）
    if (state.x !== undefined && state.y !== undefined) {
      const displays = screen.getAllDisplays();
      const visible = displays.some((d) => {
        const { x, y, width, height } = d.bounds;
        return (
          state.x! >= x &&
          state.x! < x + width &&
          state.y! >= y &&
          state.y! < y + height
        );
      });
      if (!visible) {
        return { ...DEFAULT_STATE };
      }
    }
    return state;
  } catch (err) {
    log.warn('[window] failed to load state, using defaults', err);
    return DEFAULT_STATE;
  }
}

function persistWindowState(win: BrowserWindow) {
  try {
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: isMaximized,
    };
    writeFileSync(getStatePath(), JSON.stringify(state), 'utf8');
  } catch (err) {
    log.warn('[window] failed to persist state', err);
  }
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const state = loadWindowState();
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL;
  const iconPath = resolveIconPath();

  // dev 模式 macOS 也用我们的图标（生产由 .icns 写入 Info.plist）
  if (isDev && iconPath && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath));
  }

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: 'Amux Studio',
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false,
    },
  });

  _mainWindow = win;

  win.on('ready-to-show', () => {
    win.show();
    if (state.maximized) win.maximize();
  });

  // 持久化窗口状态
  let persistTimer: NodeJS.Timeout | null = null;
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persistWindowState(win), 500);
  };
  win.on('resize', schedulePersist);
  win.on('move', schedulePersist);
  win.on('maximize', schedulePersist);
  win.on('unmaximize', schedulePersist);

  win.on('closed', () => {
    if (persistTimer) clearTimeout(persistTimer);
    if (_mainWindow === win) _mainWindow = null;
  });

  // 加载渲染进程
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
    // 生产环境禁用 DevTools
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
  }

  return win;
}
