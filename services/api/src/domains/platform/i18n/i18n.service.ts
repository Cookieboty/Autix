import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import * as path from 'path';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  normalizeLang,
  type SupportedLanguage,
} from '@autix/i18n';
import { loadLocaleTree } from './locale-loader';

export interface I18nRequestLike {
  lang?: SupportedLanguage;
}

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly logger = new AppLogger(I18nService.name);
  private translations = new Map<string, Record<string, string>>();

  onModuleInit() {
    const localesDir = path.join(__dirname, 'locales');
    this.translations = loadLocaleTree(localesDir);
    for (const [lang, dict] of this.translations) {
      this.logger.log(`Loaded ${Object.keys(dict).length} keys for [${lang}]`);
    }
  }

  t(lang: string, key: string, args?: Record<string, unknown>): string {
    const normalized = normalizeLang(lang) ?? DEFAULT_LANGUAGE;
    const dict =
      this.translations.get(normalized) ??
      this.translations.get(FALLBACK_LANGUAGE as string);

    let msg = dict?.[key] ?? this.translations.get(FALLBACK_LANGUAGE as string)?.[key] ?? key;

    if (args) {
      for (const [k, v] of Object.entries(args)) {
        msg = msg.replaceAll(`{{${k}}}`, String(v));
      }
    }
    return msg;
  }

  /**
   * Get language from express Request object (set by I18nMiddleware).
   */
  getLang(req: I18nRequestLike): SupportedLanguage {
    return req?.lang ?? DEFAULT_LANGUAGE;
  }
}
