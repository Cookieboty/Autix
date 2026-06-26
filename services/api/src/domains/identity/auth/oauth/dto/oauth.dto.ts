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
}
