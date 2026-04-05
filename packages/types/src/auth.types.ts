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
  permissions: string[];
  roles: string[];
  sessionId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
