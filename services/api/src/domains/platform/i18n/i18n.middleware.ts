import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  DEFAULT_LANGUAGE,
  normalizeLang,
  parseAcceptLanguage,
  type SupportedLanguage,
} from '@autix/i18n';

type I18nRequest = Request & {
  lang?: SupportedLanguage;
  user?: {
    language?: string | null;
  };
};

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  use(req: I18nRequest, _res: Response, next: NextFunction) {
    let lang = DEFAULT_LANGUAGE;

    if (req.user?.language) {
      lang = normalizeLang(req.user.language) ?? lang;
    } else if (req.headers['accept-language']) {
      lang = parseAcceptLanguage(req.headers['accept-language']);
    }

    req.lang = lang;
    next();
  }
}
