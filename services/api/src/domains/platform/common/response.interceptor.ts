import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@autix/domain';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { I18nService } from '../i18n/i18n.service';
import { TraceContext } from './trace-context';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const lang = request?.lang ?? DEFAULT_LANGUAGE;

    return next.handle().pipe(
      map((data) => {
        // 从请求级 AsyncLocalStorage 读取 traceId，与所有 logger 输出保持同一 ID；
        // main.ts 的 traceContextBootstrap 兜底保证 store 一定存在，缺省仍返回空串。
        const traceId = TraceContext.getTraceId() ?? '';
        if (data && typeof data === 'object' && 'success' in data) {
          // 部分接口自行返回 { success: true, ... } 的形状（不走标准包装）；
          // 这里补写 traceId，保证响应体与日志/响应头能通过 traceId 关联。
          const shaped = data as Record<string, unknown> & { traceId?: string };
          if (typeof shaped.traceId !== 'string' || shaped.traceId.length === 0) {
            shaped.traceId = traceId;
          }
          return shaped;
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
