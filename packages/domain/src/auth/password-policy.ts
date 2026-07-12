/**
 * 密码策略（domain 单一事实源）。
 *
 * 注册、忘记密码重置、管理员创建/重置、登录态设/改密码等所有入口共用同一套规则，
 * 避免规则在多个 DTO 中漂移（spec §3.3 password-policy）。
 *
 * - `PASSWORD_REGEX`：至少包含大写、小写、数字各一位。
 * - `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH`：长度边界，后端 DTO 与前端表单共同引用。
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_VALIDATION_MESSAGE = '密码必须包含大写字母、小写字母和数字';
export const PASSWORD_LENGTH_MESSAGE = `密码长度必须在 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位之间`;
