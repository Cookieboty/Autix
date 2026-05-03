import { app, BrowserWindow, crashReporter, shell } from 'electron';
import log from 'electron-log/main';
import { createMainWindow, getMainWindow } from './window';

// 应用名（dev 模式下 dock / 任务栏 / 关于面板会读这个值；生产由 electron-builder 写 Info.plist）
app.setName('Amux Studio');

if (process.platform === 'darwin') {
  app.setAboutPanelOptions({
    applicationName: 'Amux Studio',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026 Amux',
    website: 'https://amux.ai',
  });
}

// 原生崩溃报告（C++ 崩溃才会触发）— 开启后可通过 minidump 排查
// 未配 submitURL 时仅本地保存 dump 文件，不上传
crashReporter.start({
  productName: 'AmuxStudio',
  uploadToServer: false,
  ignoreSystemCrashHandler: false,
  rateLimit: true,
});
import { registerAuthIpc } from './ipc/auth';
import { registerWindowCtrlIpc } from './ipc/window-ctrl';
import { registerFilesIpc } from './ipc/files';
import { registerNotificationsIpc } from './ipc/notifications';
import { registerResourceIpc } from './ipc/resource';
import { registerMenu } from './menu';
import { registerTray } from './tray';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts';
import { registerDeepLink } from './deep-link';
import { initUpdater } from './updater';

log.initialize({ preload: true });
log.info(`[app] starting Amux Studio (electron ${process.versions.electron})`);

// 主进程兜底
process.on('uncaughtException', (err) => {
  log.error('[main] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  log.error('[main] unhandledRejection', reason);
});

// 单实例锁 — 第二实例启动时聚焦主窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    // Win/Linux：deep link 通过命令行参数传入
    const url = argv.find((arg) => arg.startsWith('autix://'));
    if (url) {
      const deepLink = require('./deep-link') as typeof import('./deep-link');
      deepLink.handleDeepLink(url);
    }
  });
}

// 协议注册（必须在 app.whenReady 之前）
registerDeepLink();

app.whenReady().then(async () => {
  registerAuthIpc();
  registerWindowCtrlIpc();
  registerFilesIpc();
  registerNotificationsIpc();
  registerResourceIpc();

  await createMainWindow();

  registerMenu();
  registerTray();
  registerGlobalShortcuts();

  // 30s 后检查更新（MVP 仅提示，不自动安装）
  setTimeout(() => {
    initUpdater();
  }, 30_000);

  app.on('activate', () => {
    // macOS：dock 图标点击重新显示窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    } else {
      const win = getMainWindow();
      win?.show();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 默认不退出，符合系统习惯
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});

// 阻止任意页面打开外链（统一走 setWindowOpenHandler）
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch((err) => log.warn('openExternal failed', err));
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    const allowedPrefixes = [
      'http://localhost:',
      'app://desktop',
      'file://',
    ];
    if (!allowedPrefixes.some((p) => url.startsWith(p))) {
      e.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });
});
