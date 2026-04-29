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

interface UserServiceGrpc {
  checkAdmin(data: CheckAdminRequest): Observable<CheckAdminResponse>;
  getUserInfo(data: GetUserInfoRequest): Observable<GetUserInfoResponse>;
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
}
