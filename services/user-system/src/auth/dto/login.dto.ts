import { IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
