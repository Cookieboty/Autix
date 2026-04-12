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
        // Handle pagination response: { data: [...], total, page, pageSize, ... }
        // Wrap into: { list: [...], pagination: {...} }
        if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          return {
            success: true,
            code: '200',
            msg: '请求成功',
            traceId,
            data: {
              list: data.data,
              pagination: {
                total: data.total,
                page: data.page,
                pageSize: data.pageSize,
                totalPages: data.totalPages,
              },
            },
          } as ApiResponse;
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
