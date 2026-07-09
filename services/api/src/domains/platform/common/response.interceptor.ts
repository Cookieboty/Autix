import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@autix/domain';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const lang = request?.lang ?? DEFAULT_LANGUAGE;

    return next.handle().pipe(
      map((data) => {
        const traceId = crypto.randomUUID();
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        return {
          success: true,
          code: '200',
          msg: this.i18n.t(lang, 'common.request_success'),
          traceId,
          data,
        } as ApiResponse;
      }),
    );
  }
}
