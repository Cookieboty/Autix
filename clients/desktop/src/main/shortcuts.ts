import { globalShortcut } from 'electron';
import log from 'electron-log/main';
import { getMainWindow } from './window';

const SHORTCUTS = {
  /** 唤起/隐藏主窗口 */
  TOGGLE_WINDOW: 'CmdOrCtrl+Shift+Space',
  /** 新建对话 */
  NEW_CHAT: 'CmdOrCtrl+Shift+N',
} as const;

export function registerGlobalShortcuts(): void {
  try {
    const ok1 = globalShortcut.register(SHORTCUTS.TOGGLE_WINDOW, () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isVisible() && !win.isMinimized()) {
        win.hide();
      } else {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    });
    if (!ok1) log.warn(`[shortcuts] failed to register ${SHORTCUTS.TOGGLE_WINDOW}`);

    const ok2 = globalShortcut.register(SHORTCUTS.NEW_CHAT, () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send('shortcut:new-chat', '/chat');
    });
    if (!ok2) log.warn(`[shortcuts] failed to register ${SHORTCUTS.NEW_CHAT}`);
  } catch (err) {
    log.warn('[shortcuts] register failed', err);
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
