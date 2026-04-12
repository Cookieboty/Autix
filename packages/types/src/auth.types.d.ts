export interface JwtPayload {
    sub: string;
    username: string;
    sessionId: string;
    iat?: number;
    exp?: number;
}
export interface AuthUser {
    id: string;
    username: string;
    email: string;
    realName?: string;
    avatar?: string;
    departmentId?: string;
    isSuperAdmin: boolean;
    status: string;
    permissions: string[];
    roles: string[];
    currentSystemId?: string;
    sessionId?: string;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
