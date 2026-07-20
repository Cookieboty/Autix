# CLAUDE.md

> **先读 `AGENTS.md`**——那是本项目的开发协议（分层、文件体量、目录规范、复杂流程、验证要求），本文件不重复它，只补充 Claude Code 工作时需要的导航信息、命令速查和踩坑清单。两者冲突时以 `AGENTS.md` 为准。

## 这是什么

Autix Studio：pnpm + turborepo monorepo，AI 创作平台。Web（Next.js）+ Desktop（Electron）双端共享 UI 与状态，后端 NestJS 按领域聚合。

技术栈主版本：Next.js 16（App Router）/ React 19 / NestJS 11 / Prisma 7 / Vitest 4（`clients/desktop` 是 2.x，`packages/ai-adapters` 是 3.x，版本有真实偏差）/ TypeScript 5.7 / Tailwind v4 / zustand 5 / TanStack Query 5 / next-intl 4。包管理器 pnpm 11（`packageManager` 字段锁定），**只用 pnpm，不要用 npm/yarn/bun**。

## 仓库导航

```
clients/web          @autix/web       Next.js App Router，路由/layout/metadata，页面要薄
clients/desktop      @autix/desktop   Electron main/preload/IPC + 桌面路由入口
services/api         @autix/api       NestJS，src/domains/<domain>/<module>/
packages/domain      @autix/domain    领域类型/DTO/枚举/权限常量，零运行时依赖
packages/sdk         @autix/sdk       类型安全 API client（前端只能经 shared-store 间接用）
packages/platform    @autix/platform  Web/Desktop runtime adapter 单例（auth/navigation/env）
packages/shared-ui   @autix/shared-ui 跨端 UI 与业务组件，~35 个 subpath export
packages/shared-store @autix/shared-store  跨端 client/workflow state
packages/database    @autix/database  Prisma schema / migration / seed
packages/ai-adapters @autix/ai-adapters   AI provider 适配
packages/i18n        @autix/i18n      国际化文案（文件即真源，无 codegen）
```

依赖方向见 `AGENTS.md`。**边界由 `scripts/check-architecture-boundaries.ts` 强制**，不是建议——它是 lefthook pre-commit 钩子。改动前先扫一眼里面的规则表，比事后被拦下来快。

## 常用命令

```bash
pnpm dev                # = dev:web，起 web(3100) + api(4100)，不跑迁移/seed
pnpm dev:api            # 清端口 + db:deploy + seed:pricing + 只起 api
pnpm dev:desktop        # 清端口 + db:deploy + seed:pricing + desktop + api
pnpm typecheck          # lefthook pre-push 钩子
pnpm lint               # eslint .
pnpm arch:check         # 架构边界，lefthook pre-commit 钩子
pnpm i18n:check         # i18n 一致性（规则很多，见下）
pnpm db:generate        # prisma generate
pnpm db:migrate         # migrate dev
pnpm db:deploy          # migrate deploy
```

端口：web `3100`、api `4100`（`5173` 也会被 `clean:ports` 清）。web/desktop dev 都 `wait-on tcp:4100`，**API 必须先起来**。`.env` 在仓库根，所有脚本用 `dotenv -e .env --` 注入。

### 验证：优先跑局部，别跑全量

`AGENTS.md` 有明确规定——改了哪个文件就跑哪个 spec：

```bash
pnpm exec vitest run path/to/one.spec.ts        # 秒级
pnpm --filter @autix/shared-ui run test
pnpm --filter @autix/api run typecheck
```

全量 `pnpm test` 约 40s、`pnpm typecheck` 约 21s（首次；turbo 缓存命中后接近 0）。除非确实要做全量回归，否则不要跑。

## 测试文件放哪（各包不一致，务必对照）

| 包 | spec 位置 |
|---|---|
| `services/api` | 与源码同目录 `src/**/*.spec.ts` |
| `packages/{shared-store,sdk,domain,ai-adapters}` | 同目录 `src/**/*.spec.ts`，无 vitest config |
| `packages/shared-ui` | **两处都扫**：`test/**/*.test.{ts,tsx}` 和 `src/**/*.spec.{ts,tsx}` |
| `clients/web` | `clients/web/test/`，`**/*.test.{ts,tsx}`，jsdom |
| `clients/desktop` | `test/**/*.spec.{ts,tsx}`，**node 环境**（只做 renderToStaticMarkup） |
| `packages/database` | `test/*.spec.ts`，其 `test` 脚本会先 build |
| 根 | `scripts/**/__tests__/**/*.{test,spec}.ts`，走 `vitest.root.config.ts` |

`@testing-library/react` 只在 `clients/web` 声明。`services/api/e2e/payments.e2e.ts` 需要真实 DB + Stripe CLI + Playwright + 先 build，**不在 `pnpm test` 里**，走 `pnpm --filter @autix/api test:e2e`。

## i18n

- 语言 7 种：`zh-CN zh-TW en fr ja ru vi`。**基线是 `en`，不是 zh-CN。**
- chunk 8 个（`packages/i18n/src/messages.ts` 的 `CHUNKS`）：`common auth landing studio membership profile admin docs`。每个 chunk 下 7 个 locale JSON 全都要有。
- 新增 chunk 要同时改 `CHUNKS` 和 `chunkLoaders`。
- 另有一套**独立的** API 错误文案：`services/api/src/domains/platform/i18n/locales/<domain>/<lang>.yaml`，扁平 dot-key、`{{name}}` 插值（前端 next-intl 用 `{name}`）。跨文件 key 冲突会硬失败。
- 改完 `packages/i18n/src/messages/**` 必须 `pnpm --filter @autix/i18n build`（build 里有 `cp -R` 步骤），否则 `i18n:check` 报 dist 过期。
- 新增 `clients/web/app/[locale]/**/page.tsx` 必须在 `clients/web/lib/i18n/route-policy.ts` 的 `ROUTE_POLICY` 登记，否则 `i18n:check` 失败。

## 类型与别名

`tsconfig.base.json` 把 `@autix/<pkg>` 映射到 **`packages/<pkg>/src`（源码，非 dist）**。例外：

- `clients/web` 和 `clients/desktop` **不 extends** base；web 自己有 `@/*` → `./*`。
- `services/api` extends base，但把 `@autix/domain` 覆盖成 `packages/domain/dist/index.d.ts`——所以它是对着 domain 的**构建产物**做类型检查（turbo 里的 `^build` 依赖就是为此）。

strict 情况：base **不开** strict；`clients/web`、`packages/{domain,shared-ui,shared-store}` 开 `strict: true`；`services/api` 只开 `strictNullChecks`。

ESLint 扁平配置，`no-explicit-any` 和 `no-unused-vars` 是 **warn**（`_` 前缀豁免），`no-console` 关闭。

## 踩坑清单

**别整读的大文件**（读之前先 grep 定位行号，用 offset/limit 局部读）：

- `packages/database/src/generated/**` —— Prisma 生成物，`User.ts` 单文件 1.3MB。**永远不要手改**，用 `pnpm db:generate` 重新生成。已被 gitignore 和 eslint 忽略。
- `packages/i18n/src/messages/**` —— admin 532K、studio 468K、landing 448K，单个 locale JSON 就有 60–95KB。
- `packages/shared-ui/src/draw/DrawWorkspace.tsx` 101KB、`packages/sdk/src/client.ts` 98KB、`services/api/src/domains/creation/gallery/gallery.service.ts` 46KB。

**三个 ratchet 基线文件，增和减都会失败**：

- `scripts/i18n/untranslated-baseline.json` —— 翻译了却不下调基线会红。
- `scripts/i18n/cjk-string-baseline.json` —— 在已清零的 API 域里写中文字符串字面量会红；用户可见中文应走 `I18nHttpException` + key。
- `scripts/growth-hotspot-baseline.json` —— `packages/shared-ui/src/growth` 下的硬编码颜色和 `locale.startsWith('zh')` 计数。

**其他容易中招的**：

- `clients/**` 直接 `import '@autix/sdk'` 是 arch:check 硬失败，**尽管 `clients/web` 的 package.json 里确实列了这个依赖**——那是个陷阱。走 shared-store / controller hook。
- `services/api/src` 根目录只允许 `app.controller.ts` `app.module.ts` `app.service.ts` `main.ts` 和 `domains/`，多一个文件就红。新增 API 模块还要接进领域聚合 module，新领域要登记进边界脚本的 `apiDomainModules`。
- `*.controller.ts` 不能注入 `PrismaService`；多数领域里 `this.prisma` 只允许出现在 `*.repository.ts`。
- `packages/shared-ui` 禁 `fetch(` / `axios` / `localStorage` / `WebSocket` / `electron`——唯一豁免文件是 `src/hooks/useIsElectron.ts`。
- `pnpm-workspace.yaml` 设了 `verifyDepsBeforeRun: false`，**改完 package.json 不会有任何提示**，得自己 `pnpm install`。
- `nodeLinker: hoisted`（electron-builder 要求），依赖解析行为和默认 pnpm 不同。
- `packages/shared-ui` 从 subpath 导入（`@autix/shared-ui/draw`），不要走根 barrel。
- `packages/shared-lib` 和 `packages/types` 已删除，边界脚本会主动拦截复活它们。
- CI 只有 `.github/workflows/docker-build.yml`（构建镜像），**没有 lint/test/typecheck 工作流**——本地校验就是最后一道关。

## Git

`AGENTS.md` 规定 `docs/`、`.Codex/` 不进版本库，且不要执行 `git reset --hard` / `git checkout --` / `git restore` 等可能覆盖他人改动的命令。提交由用户决定，不要自作主张 commit/push。
