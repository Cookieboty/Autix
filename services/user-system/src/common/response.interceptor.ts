import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@autix/types';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const traceId = crypto.randomUUID();
        // If already wrapped (e.g. logout returns { message }), keep as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        return {
          success: true,
          code: '200',
          msg: '请求成功',
          traceId,
          data,
        } as ApiResponse;
      }),
    );
  }
}
