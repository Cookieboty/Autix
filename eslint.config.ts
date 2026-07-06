import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/**/*.{ts,tsx}', 'clients/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 允许类型安全的 `import x = require()` CJS 互操作写法（后端 commonjs 无 esModuleInterop 时必需），
      // 但仍禁止松散的 require() 调用。
      '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true }],
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/src/generated/**',
      '**/generated/**',
    ],
  },
);
