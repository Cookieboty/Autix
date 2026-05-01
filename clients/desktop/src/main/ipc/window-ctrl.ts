import { app, ipcMain } from 'electron';
import { z } from 'zod';
import { getMainWindow } from '../window';

export function registerWindowCtrlIpc(): void {
  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize();
  });
  ipcMain.handle('window:maximize', () => {
    getMainWindow()?.maximize();
  });
  ipcMain.handle('window:unmaximize', () => {
    getMainWindow()?.unmaximize();
  });
  ipcMain.handle('window:close', () => {
    getMainWindow()?.close();
  });
  ipcMain.handle('window:is-maximized', () => {
    return getMainWindow()?.isMaximized() ?? false;
  });
  ipcMain.handle('window:set-full-screen', (_e, raw) => {
    const flag = z.boolean().parse(raw);
    getMainWindow()?.setFullScreen(flag);
  });
  ipcMain.handle('window:toggle-dev-tools', () => {
    if (process.env.NODE_ENV !== 'development') return;
    const win = getMainWindow();
    if (win?.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win?.webContents.openDevTools({ mode: 'detach' });
    }
  });
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-platform', () => process.platform);
}
