import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto email normalization', () => {
  it('管理员建号邮箱应 trim + lowercase 归一', () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'admin1',
      email: '  Admin@Example.COM  ',
    });
    expect(dto.email).toBe('admin@example.com');
  });
});
