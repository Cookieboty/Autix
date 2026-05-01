import { ipcMain, shell, app } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log/main';
import { z } from 'zod';
import { getMainWindow } from './window';

/**
 * MVP 自动更新策略 — 仅检查并提示，**不**自动下载/安装。
 * 没有代码签名前自动安装会让用户被 Gatekeeper / SmartScreen 拦截，
 * 让用户手动从 release 页面下载并自行同意警告，体验差但不致命。
 */

const RELEASES_URL_BASE = 'https://github.com/cookieboty/amux-studio/releases/tag';

let _initialized = false;

export function initUpdater(): void {
  if (_initialized) return;
  _initialized = true;

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    const win = getMainWindow();
    if (!win) return;
    win.webContents.send('updater:available', {
      version: info.version,
      releaseUrl: `${RELEASES_URL_BASE}/v${info.version}`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] no update available');
  });

  autoUpdater.on('error', (err) => {
    log.warn('[updater] error', err);
  });

  // 注册 IPC handler
  ipcMain.handle('updater:open-release', (_e, raw) => {
    const url = z.string().url().parse(raw);
    if (!url.startsWith('https://github.com/')) {
      throw new Error('Invalid release URL');
    }
    return shell.openExternal(url);
  });

  ipcMain.handle('updater:check-now', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      log.warn('[updater] checkForUpdates failed', err);
    }
  });

  // 启动时检查（已在 main/index.ts 调用 initUpdater 后立即检查）
  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('[updater] initial check failed', err);
  });

  log.info(`[updater] initialized for v${app.getVersion()}`);
}
