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

// 说明：此前这里有 PASSWORD_VALIDATION_MESSAGE / PASSWORD_LENGTH_MESSAGE 两个文案常量，
// 仅用于后端 DTO 的 @Matches({ message }) / 长度校验。但全局 ValidationPipe 的
// exceptionFactory 只把违规约束**码**（`{ path, codes }`）透给前端、丢弃 message 文本
// （见 validation-violations.ts），前端按 code 自行本地化。故这两个常量永不到达用户，
// 属"看着像文案、实则永不出现"的死字符串，已删除；密码错误的本地化在前端。
