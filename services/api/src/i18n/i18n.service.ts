import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  normalizeLang,
  type SupportedLanguage,
} from '@autix/i18n';

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly logger = new Logger(I18nService.name);
  private translations = new Map<string, Record<string, string>>();

  onModuleInit() {
    const localesDir = path.join(__dirname, 'locales');
    const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.yaml'));

    for (const file of files) {
      const lang = file.replace('.yaml', '');
      const content = fs.readFileSync(path.join(localesDir, file), 'utf-8');
      const dict = yaml.load(content) as Record<string, string>;
      this.translations.set(lang, dict ?? {});
      this.logger.log(`Loaded ${Object.keys(dict ?? {}).length} keys for [${lang}]`);
    }
  }

  t(lang: string, key: string, args?: Record<string, any>): string {
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
  getLang(req: any): SupportedLanguage {
    return req?.lang ?? DEFAULT_LANGUAGE;
  }
}
