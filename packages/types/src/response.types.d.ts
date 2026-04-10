export interface ApiResponse<T = any> {
    success: boolean;
    code: string;
    msg: string;
    traceId: string;
    data: T;
}
export type ErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR' | 'VALIDATION_ERROR';
export declare function buildSuccess<T>(data: T, msg?: string): ApiResponse<T>;
export declare function buildError(code: ErrorCode, msg: string, traceId?: string): ApiResponse<null>;
