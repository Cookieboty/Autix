import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { USER_GRPC_CLIENT } from '@autix/contracts';

interface CheckAdminRequest {
  userId: string;
}

interface CheckAdminResponse {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  roles: string[];
}

interface GetUserInfoRequest {
  userId: string;
}

interface GetUserInfoResponse {
  userId: string;
  username: string;
  email: string;
  isSuperAdmin: boolean;
  roles: string[];
}

interface ListUsersRequest {
  page: number;
  pageSize: number;
  search: string;
}

interface UserItem {
  userId: string;
  username: string;
  email: string;
  realName: string;
  status: string;
}

interface ListUsersResponse {
  users: UserItem[];
  total: number;
}

interface ApproveUserRequest {
  userId: string;
  adminUserId: string;
  note: string;
}

export interface ApproveUserResponse {
  success: boolean;
  message: string;
}

interface ValidateSessionRequest {
  sessionId: string;
}

export interface ValidateSessionResponse {
  valid: boolean;
  userId: string;
}

interface UserServiceGrpc {
  checkAdmin(data: CheckAdminRequest): Observable<CheckAdminResponse>;
  getUserInfo(data: GetUserInfoRequest): Observable<GetUserInfoResponse>;
  listUsers(data: ListUsersRequest): Observable<ListUsersResponse>;
  approveUser(data: ApproveUserRequest): Observable<ApproveUserResponse>;
  validateSession(data: ValidateSessionRequest): Observable<ValidateSessionResponse>;
}

@Injectable()
export class UserRpcService implements OnModuleInit {
  private userService!: UserServiceGrpc;

  constructor(@Inject(USER_GRPC_CLIENT) private client: ClientGrpc) {}

  onModuleInit() {
    this.userService = this.client.getService<UserServiceGrpc>('UserService');
  }

  async checkAdmin(userId: string): Promise<CheckAdminResponse> {
    return firstValueFrom(this.userService.checkAdmin({ userId }));
  }

  async getUserInfo(userId: string): Promise<GetUserInfoResponse> {
    return firstValueFrom(this.userService.getUserInfo({ userId }));
  }

  async listUsers(page: number, pageSize: number, search: string): Promise<ListUsersResponse> {
    return firstValueFrom(this.userService.listUsers({ page, pageSize, search }));
  }

  async approveUser(userId: string, adminUserId: string, note?: string): Promise<ApproveUserResponse> {
    return firstValueFrom(this.userService.approveUser({ userId, adminUserId, note: note || '' }));
  }

  async validateSession(sessionId: string): Promise<ValidateSessionResponse> {
    return firstValueFrom(this.userService.validateSession({ sessionId }));
  }
}
