# Project Rules

## 运行时

- **使用 Bun 运行**：本项目使用 Bun（`bun run`、`bun test` 等），不要使用 npm/yarn/pnpm
- package.json 中的 scripts 使用 Bun 执行

- **禁止将 `docs/`、`.Codex/`、`AGENTS.md` 提交到 git**
- 这些文件/目录已在 `.gitignore` 中排除
- 执行 `git add` 时不得包含上述路径下的任何文件
- 设计文档、计划文档、memory 文件均属内部工作产物，不进入版本库
