import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  RegisterDto,
  ForgotPasswordDto,
  ResendActivationDto,
  RequestEmailSupplementDto,
  RequestEmailChangeDto,
} from './login.dto';

const REGISTER_BASE = {
  username: 'alice',
  password: 'Abcdef1!',
  systemCode: 'main',
};

describe('login.dto email normalization', () => {
  it('RegisterDto 邮箱应被 trim + lowercase 归一', () => {
    const dto = plainToInstance(RegisterDto, {
      ...REGISTER_BASE,
      email: '  Alice@Example.COM  ',
    });
    expect(dto.email).toBe('alice@example.com');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('ForgotPasswordDto 邮箱应归一', () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'Bob@X.io' });
    expect(dto.email).toBe('bob@x.io');
  });

  it('ResendActivationDto 邮箱应归一', () => {
    const dto = plainToInstance(ResendActivationDto, { email: 'CC@Y.com' });
    expect(dto.email).toBe('cc@y.com');
  });

  it('RequestEmailSupplementDto 邮箱应归一', () => {
    const dto = plainToInstance(RequestEmailSupplementDto, { email: 'DD@Y.com' });
    expect(dto.email).toBe('dd@y.com');
  });

  it('RequestEmailChangeDto 邮箱应归一，proof 不受影响', () => {
    const dto = plainToInstance(RequestEmailChangeDto, {
      email: 'EE@Y.com',
      proof: 'PROOF-Token-Keep-Case',
    });
    expect(dto.email).toBe('ee@y.com');
    expect(dto.proof).toBe('PROOF-Token-Keep-Case');
  });

  it('username 含 @ 应校验失败', () => {
    const dto = plainToInstance(RegisterDto, {
      ...REGISTER_BASE,
      username: 'ali@ce',
      email: 'alice@example.com',
    });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });
});
