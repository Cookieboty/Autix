import { Tray, Menu, app, nativeImage } from 'electron';
import log from 'electron-log/main';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getMainWindow } from './window';

let _tray: Tray | null = null;

function getTrayIconPath(): string {
  // 优先用 tray 专用图标（黑白模板风格更适合系统托盘），找不到则回退主 icon
  const candidates = [
    join(__dirname, '../../resources/tray-icon.png'),
    join(__dirname, '../resources/tray-icon.png'),
    join(process.resourcesPath ?? '', 'tray-icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../resources/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png'),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

export function registerTray(): void {
  try {
    const iconPath = getTrayIconPath();
    let image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
      // 占位：1x1 透明，避免崩溃
      image = nativeImage.createEmpty();
    }
    if (process.platform === 'darwin') {
      image.setTemplateImage(true);
    }
    _tray = new Tray(image);
    _tray.setToolTip('Amux Studio');

    const showWindow = () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    };

    const menu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: showWindow,
      },
      {
        label: '新建对话',
        click: () => {
          showWindow();
          getMainWindow()?.webContents.send('shortcut:new-chat', '/chat');
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);

    _tray.setContextMenu(menu);

    // macOS 单击切换显示，Windows/Linux 默认双击。这里都绑定单击 toggle。
    _tray.on('click', () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isVisible() && !win.isMinimized()) {
        win.hide();
      } else {
        showWindow();
      }
    });
  } catch (err) {
    log.warn('[tray] failed to create tray', err);
  }
}

export function destroyTray(): void {
  if (_tray) {
    _tray.destroy();
    _tray = null;
  }
}
