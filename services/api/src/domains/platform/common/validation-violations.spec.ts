import type { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-violations';

// class-validator 的 ValidationError 是普通对象，测试里直接构造字面量即可。
function ve(props: Partial<ValidationError>): ValidationError {
  return props as ValidationError;
}

describe('flattenValidationErrors', () => {
  it('flattens a single-level error into { path, codes }', () => {
    const errors = [
      ve({
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { path: 'email', codes: ['isEmail'] },
    ]);
  });

  it('preserves multiple constraint codes per field in declaration order', () => {
    // Object.keys 顺序即为 constraints 声明顺序，前端依赖此顺序做优先级降级。
    const errors = [
      ve({
        property: 'password',
        constraints: {
          isNotEmpty: 'password should not be empty',
          minLength: 'password must be longer than or equal to 6 characters',
        },
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { path: 'password', codes: ['isNotEmpty', 'minLength'] },
    ]);
  });

  it('flattens nested DTO errors into dotted paths', () => {
    const errors = [
      ve({
        property: 'profile',
        children: [
          ve({
            property: 'avatar',
            constraints: { isUrl: 'avatar must be a URL' },
          }),
        ],
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { path: 'profile.avatar', codes: ['isUrl'] },
    ]);
  });

  it('flattens array element errors with numeric segments', () => {
    // class-validator 对数组元素校验时，children[i].property 为数字字符串索引，
    // 展平后应表现为 items.0.name，供前端定位到具体条目。
    const errors = [
      ve({
        property: 'items',
        children: [
          ve({
            property: '0',
            children: [
              ve({
                property: 'name',
                constraints: { isNotEmpty: 'name should not be empty' },
              }),
            ],
          }),
        ],
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { path: 'items.0.name', codes: ['isNotEmpty'] },
    ]);
  });

  it('emits both parent-level and child-level violations when a node has constraints and children', () => {
    // 少见但合法：父节点既有直接 constraints（如 @IsObject 失败）也有子节点错误。
    // 两条 violation 都必须出现，且路径互不覆盖。
    const errors = [
      ve({
        property: 'meta',
        constraints: { isObject: 'meta must be an object' },
        children: [
          ve({
            property: 'title',
            constraints: { isString: 'title must be a string' },
          }),
        ],
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { path: 'meta', codes: ['isObject'] },
      { path: 'meta.title', codes: ['isString'] },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(flattenValidationErrors([])).toEqual([]);
  });
});
