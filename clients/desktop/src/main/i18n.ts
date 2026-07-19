import { app } from 'electron';
import log from 'electron-log/main';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  isSupportedLang,
  loadMessages,
  normalizeLang,
  type SupportedLanguage,
} from '@autix/i18n';

let currentLocale: SupportedLanguage = DEFAULT_LANGUAGE;
let messages: Record<string, unknown> = {};

function readPrefsLanguage(): SupportedLanguage {
  try {
    const file = join(app.getPath('userData'), 'prefs.json');
    if (!existsSync(file)) return DEFAULT_LANGUAGE;
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { language?: unknown };
    if (typeof raw.language !== 'string' || raw.language.length === 0) {
      return DEFAULT_LANGUAGE;
    }
    if (isSupportedLang(raw.language)) return raw.language;
    return normalizeLang(raw.language) ?? DEFAULT_LANGUAGE;
  } catch (err) {
    log.warn('[i18n] failed to read prefs.json language, falling back', err);
    return DEFAULT_LANGUAGE;
  }
}

export async function initMainI18n(): Promise<void> {
  currentLocale = readPrefsLanguage();
  try {
    messages = await loadMessages(currentLocale, ['common']);
  } catch (err) {
    log.warn('[i18n] loadMessages failed, falling back to', FALLBACK_LANGUAGE, err);
    currentLocale = FALLBACK_LANGUAGE;
    messages = await loadMessages(FALLBACK_LANGUAGE, ['common']);
  }
}

function resolveKey(key: string): string | undefined {
  const segments = key.split('.');
  let cursor: unknown = messages;
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const raw = resolveKey(key);
  if (raw == null) return key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
  );
}

export function getMainLocale(): SupportedLanguage {
  return currentLocale;
}
