import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { ResetPasswordDto } from './reset-password.dto';

function createUserWithPassword(password?: string): CreateUserDto {
  return Object.assign(new CreateUserDto(), {
    username: 'alice',
    email: 'alice@example.com',
    ...(password === undefined ? {} : { password }),
  });
}

function resetPassword(newPassword: string): ResetPasswordDto {
  return Object.assign(new ResetPasswordDto(), { newPassword });
}

describe('admin password DTO validation', () => {
  it('allows an omitted create password and accepts the shared valid password shape', async () => {
    expect(await validate(createUserWithPassword())).toHaveLength(0);
    expect(await validate(createUserWithPassword('Password1'))).toHaveLength(0);
    expect(await validate(resetPassword('Password1'))).toHaveLength(0);
  });

  it.each([
    'Pass1',
    `${'A'.repeat(127)}a1`,
    'password1',
    'PASSWORD1',
    'Password',
  ])('rejects an invalid create password: %s', async (password) => {
    const errors = await validate(createUserWithPassword(password));
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it.each([
    'Pass1',
    `${'A'.repeat(127)}a1`,
    'password1',
    'PASSWORD1',
    'Password',
  ])('rejects an invalid reset password: %s', async (password) => {
    const errors = await validate(resetPassword(password));
    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });
});
