import { IsIn, IsOptional, IsString } from 'class-validator';

export class AuthorizeQueryDto {
  @IsString() systemCode!: string;
  @IsIn(['web', 'desktop']) clientType!: 'web' | 'desktop';
  @IsString() redirectUri!: string;
  @IsOptional() @IsString() inviteCode?: string;
  @IsOptional() @IsString() deviceId?: string;
}
export class CallbackQueryDto {
  @IsOptional() @IsString() code?: string;
  @IsString() state!: string;
  @IsOptional() @IsString() error?: string;
}
export class ExchangeDto {
  @IsString() code!: string;
}
export class LinkBodyDto {
  @IsString() systemCode!: string;
  @IsIn(['web', 'desktop']) clientType!: 'web' | 'desktop';
  @IsString() redirectUri!: string;
  // 安全（#3）：绑定登录凭据前必须完成 step-up（purpose='unlink-provider'）拿到的一次性 proof。
  @IsString() proof!: string;
}

export class UnlinkBodyDto {
  // 安全（#3）：解绑登录凭据前必须完成 step-up（purpose='unlink-provider'）拿到的一次性 proof。
  @IsString() proof!: string;
}
