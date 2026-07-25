import type { ValidationError } from 'class-validator';

/**
 * class-validator 校验错误的稳定 envelope 结构。
 *
 * 前端合同：
 * - `path`：DTO 字段的点分路径（嵌套/数组时展开为 `parent.child.0.field`），
 *   为空字符串时代表根对象。
 * - `codes`：违反的约束键列表（如 `isEmail`、`isNotEmpty`、`minLength`），
 *   稳定、可编程判断；不含语言文案，避免用 constraints 的英文 message 直接给用户。
 */
export interface ValidationViolation {
  path: string;
  codes: string[];
}

/**
 * 把 class-validator 的嵌套 `ValidationError[]` 展平为稳定结构 `{ path, codes }[]`。
 *
 * class-validator 的错误树结构：每个节点带 `property` 和可选 `children`；叶子节点带
 * `constraints`（键为约束名，值为默认英文 message）。我们只需要约束名列表——文案由
 * 前端按 `common.invalid_params` + `data.violations` 自行组装本地化，不依赖 constraints
 * 里的英文原文。
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationViolation[] {
  const out: ValidationViolation[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints && Object.keys(err.constraints).length > 0) {
      out.push({ path, codes: Object.keys(err.constraints) });
    }
    if (err.children && err.children.length > 0) {
      out.push(...flattenValidationErrors(err.children, path));
    }
  }
  return out;
}
