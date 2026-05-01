import { app, ipcMain, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import log from 'electron-log/main';
import { z } from 'zod';

/**
 * Token & 用户身份的安全存储：
 * - access/refresh token 经 safeStorage 加密后写到 userData/auth.bin
 * - user / language / menus / systems 等非高敏数据明文存 prefs.json
 *   （加密成本 vs 价值不匹配，这些不是凭证）
 */

const AUTH_FILE = () => join(app.getPath('userData'), 'auth.bin');
const PREFS_FILE = () => join(app.getPath('userData'), 'prefs.json');

interface TokenBundle {
  access: string;
  refresh: string;
}

interface PrefsData {
  user?: unknown;
  language?: string;
  menus?: unknown[];
  systems?: unknown[];
}

function readTokens(): TokenBundle | null {
  try {
    const file = AUTH_FILE();
    if (!existsSync(file)) return null;
    const buffer = readFileSync(file);
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn('[auth] safeStorage encryption unavailable, refusing to read');
      return null;
    }
    const decrypted = safeStorage.decryptString(buffer);
    return JSON.parse(decrypted) as TokenBundle;
  } catch (err) {
    log.warn('[auth] read tokens failed', err);
    return null;
  }
}

function writeTokens(bundle: TokenBundle): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption unavailable');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(bundle));
  writeFileSync(AUTH_FILE(), encrypted, { mode: 0o600 });
}

function clearTokensFile(): void {
  const file = AUTH_FILE();
  if (existsSync(file)) {
    try {
      unlinkSync(file);
    } catch (err) {
      log.warn('[auth] failed to delete auth.bin', err);
    }
  }
}

function readPrefs(): PrefsData {
  try {
    const file = PREFS_FILE();
    if (!existsSync(file)) return {};
    return JSON.parse(readFileSync(file, 'utf8')) as PrefsData;
  } catch (err) {
    log.warn('[auth] read prefs failed', err);
    return {};
  }
}

function writePrefs(data: PrefsData): void {
  writeFileSync(PREFS_FILE(), JSON.stringify(data), 'utf8');
}

const setTokensSchema = z.object({
  access: z.string().min(1).max(8192),
  refresh: z.string().min(1).max(8192),
});

const stringSchema = z.string().max(16);
const userSchema = z.unknown();
const arraySchema = z.array(z.unknown()).max(1024);

export function registerAuthIpc(): void {
  ipcMain.handle('auth:get-access-token', () => readTokens()?.access ?? null);
  ipcMain.handle('auth:get-refresh-token', () => readTokens()?.refresh ?? null);

  ipcMain.handle('auth:set-tokens', (_e, raw) => {
    const { access, refresh } = setTokensSchema.parse(raw);
    writeTokens({ access, refresh });
  });

  ipcMain.handle('auth:clear-tokens', () => {
    clearTokensFile();
    const prefs = readPrefs();
    delete prefs.user;
    delete prefs.menus;
    delete prefs.systems;
    writePrefs(prefs);
  });

  ipcMain.handle('auth:get-user', () => readPrefs().user ?? null);
  ipcMain.handle('auth:set-user', (_e, raw) => {
    const user = userSchema.parse(raw);
    const prefs = readPrefs();
    prefs.user = user;
    writePrefs(prefs);
  });

  ipcMain.handle('auth:get-language', () => readPrefs().language ?? null);
  ipcMain.handle('auth:set-language', (_e, raw) => {
    const lang = stringSchema.parse(raw);
    const prefs = readPrefs();
    prefs.language = lang;
    writePrefs(prefs);
  });

  ipcMain.handle('auth:get-menus', () => readPrefs().menus ?? []);
  ipcMain.handle('auth:set-menus', (_e, raw) => {
    const menus = arraySchema.parse(raw);
    const prefs = readPrefs();
    prefs.menus = menus;
    writePrefs(prefs);
  });

  ipcMain.handle('auth:get-systems', () => readPrefs().systems ?? []);
  ipcMain.handle('auth:set-systems', (_e, raw) => {
    const systems = arraySchema.parse(raw);
    const prefs = readPrefs();
    prefs.systems = systems;
    writePrefs(prefs);
  });
}
