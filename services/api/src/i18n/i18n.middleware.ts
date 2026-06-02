import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DEFAULT_LANGUAGE, normalizeLang, parseAcceptLanguage } from '@autix/i18n';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    let lang = DEFAULT_LANGUAGE;

    if ((req as any).user?.language) {
      lang = normalizeLang((req as any).user.language) ?? lang;
    } else if (req.headers['accept-language']) {
      lang = parseAcceptLanguage(req.headers['accept-language']);
    }

    (req as any).lang = lang;
    next();
  }
}
