# Autix Development Protocol

本文件是后续开发、重构、Review 和 Codex/Agent 执行任务时必须遵守的项目协议。目标是保持当前架构长期清晰：薄应用、强共享包、清晰后端领域、稳定跨端复用、类型闭环、可测试、可演进。

## 基本原则

- 不改变既有功能，除非任务明确要求。
- 不随意修改数据库表结构、接口路径、响应语义。
- 项目未上线时不需要保留旧文件路径兼容，但迁移必须保持当前功能行为不变。
- 类型治理服务于架构边界，不把“改 TS 类型”当作独立主线。
- 优先遵循现有代码风格、目录约定和本协议，再考虑新增抽象。
- 每次较大改动后必须统计剩余热点和验证结果。

## 运行时

- **使用 Bun 运行**：本项目使用 Bun（`bun run`、`bun test` 等），不要使用 npm/yarn/pnpm。
- `package.json` 中的 scripts 使用 Bun 执行。
- 新增命令、文档示例、验证说明都以 Bun 为准。

## Git 与内部文档

- **禁止将 `docs/`、`.Codex/`、`AGENTS.md` 提交到 git**。
- 这些文件/目录已在 `.gitignore` 中排除。
- 执行 `git add` 时不得包含上述路径下的任何文件。
- 设计文档、计划文档、memory 文件均属内部工作产物，不进入版本库。
- 不执行 `git reset --hard`、`git checkout --`、`git restore` 等可能覆盖他人改动的命令，除非用户明确要求。

## 文件体量规范

- 文件行数是健康信号，不是机械 KPI；拆分目标是提升可读性、边界清晰度和可测试性。
- 普通源码文件建议参考 **600-800 行**区间：低于该区间通常无需为了行数拆分，高于该区间应评估是否已经承担过多职责。
- 单个 React 页面/组件建议更小：页面组装层 200-350 行，复杂业务组件 300-500 行；如果职责单一且上下文连续，可以合理超过建议值。
- Controller/Service 文件超过 600-800 行时，优先检查是否混入了可独立测试的 use case、helper、repository、presenter 或子组件。
- 测试文件、schema、生成文件、低层 UI primitive 可以例外，但仍应按语义分组。
- 允许文件超过建议区间：只要职责单一、阅读路径顺畅、拆分会增加跳转成本或制造过多透传层，应保留并在 Review 中说明理由。

合理拆分优先级：

1. 先拆确实可复用或可单测的纯函数、格式化、映射、校验、状态收敛 helper。
2. 再拆职责完整的展示组件，例如 table、dialog、toolbar、action bar、empty state。
3. 再拆 controller hook、query hook、workflow hook，前提是能减少主流程复杂度。
4. 最后再考虑跨包抽象，避免提前抽象。

禁止过度拆分：

- 不为了把文件压到某个行数而拆分。
- 不创建只有透传 props 的一层组件，除非它表达了稳定业务概念。
- 不把强相关逻辑拆成多个需要来回跳转的小文件。
- 不新增“大而全 utils”或含义模糊的 `helpers2`、`misc`、`common` 文件。
- 不让目录层级超过理解收益；目录拆分必须能让新人更快定位代码。
- 不把一个连续业务流程拆到多个 hook 后再靠大量参数串联。

## Monorepo 分层

目标分层：

```txt
clients/web        Next.js 路由、layout、Web 平台入口
clients/desktop    Electron 壳、IPC、桌面平台入口

services/api       NestJS 后端，按领域聚合

packages/domain    领域类型、DTO、schema、权限常量、业务枚举
packages/sdk       类型安全 API client
packages/platform  Web/Desktop adapter、导航、存储、环境注入
packages/shared-ui 跨端 UI 和业务组件
packages/shared-store 跨端 client state / workflow state
packages/database  Prisma schema、migration、seed
packages/ai-adapters AI provider 适配
packages/i18n      国际化
```

依赖方向：

```txt
clients/* -> platform -> shared-ui -> shared-store -> sdk -> domain
services/api -> domain + database + ai-adapters
```

禁止：

- `shared-ui` 直接请求 API。
- `shared-ui` 直接访问 `localStorage` / Electron IPC。
- 前端直接依赖 `services/api`。
- 前端依赖 `database`。
- 后端依赖 `shared-ui`。
- 新增大而全的 re-export 兼容层。

## Client 目录规范

`clients/web` 只保留：

- Next.js route/page/layout/middleware。
- Web-only provider 或平台入口。
- 路由参数解析、导航注入、SEO/metadata。

`clients/desktop` 只保留：

- Electron main/preload/IPC。
- 桌面路由入口。
- Desktop-only adapter 注入。

禁止在 client 页面中堆业务 UI。页面应优先像这样：

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { SomeSharedView } from '@autix/shared-ui/somewhere';

export default function Page() {
  const router = useRouter();
  return <SomeSharedView onNavigate={(path) => router.push(path)} />;
}
```

## Shared UI 目录规范

`packages/shared-ui` 按 feature 拆分：

```txt
src/chat
src/video
src/image
src/marketplace
src/admin
src/membership
src/materials
src/profile
src/resources
src/providers
src/ui
```

feature 内建议结构：

```txt
FeatureView.tsx              页面级组装层
FeatureController.ts / hook  状态与动作编排
FeatureParts.tsx             只含小型展示组件
feature-helpers.ts           纯函数、映射、格式化
feature-types.ts             局部类型
__tests__ 或 test/*          纯函数/关键行为测试
```

规则：

- 基础 UI 不依赖业务 store。
- 业务 UI 通过 props 或 controller hook 接入数据。
- 大组件优先拆 `Header`、`Toolbar`、`Table`、`Dialog`、`ActionBar`、`EmptyState`、`Preview`。
- helper 必须尽量纯函数，方便单测。
- 共享 UI 不做平台判断，平台差异放入 `packages/platform` 或由 client 注入。

## Shared Store 与 Query/Controller Hooks

状态分层：

- server state：React Query 管 API 缓存。
- client state：Zustand 管本地 UI 状态、草稿、当前选择。
- workflow state：后端持久化 + SSE 推送。

规则：

- store 不混合长期 API cache 和纯 UI state。
- 列表数据、详情数据、分页、刷新优先使用 query hooks。
- 复杂页面应有 controller hook，页面组件只负责组装。
- SSE、上传、生成、支付这类流程动作要收口到明确 hook/service，避免散落到 UI。

## 后端领域目录规范

`services/api/src/domains` 按领域聚合：

```txt
identity     auth/user/role/permission/session
billing      membership/points/order/campaign/invite
creation     conversation/message/llm/artifact/image/video/materials
marketplace  agents/skills/mcp/templates/acquisitions
admin        audit/batch/migration
platform     storage/mail/sse/i18n/system-settings
```

模块内部建议结构：

```txt
*.controller.ts       鉴权、参数解析、调用 use case
*.service.ts          application service，编排业务流程
*.domain-service.ts   可复用业务规则
*.repository.ts       Prisma 查询集中处
*.helpers.ts          纯函数、状态收敛、映射
dto/                  入参 DTO
*.spec.ts             关键行为测试
```

规则：

- Controller 不直接碰 Prisma。
- Prisma 查询集中在 repository/service 内。
- 复杂流程必须有状态收敛入口。
- 积分扣费/冻结/退款、订单回调、AI 生成回调必须保持幂等。
- 后端公共契约优先从 `packages/domain` 引用。

## 复杂流程规范

视频、图片、LLM、计费、Marketplace 属于高风险流程：

- 先写行为护栏或纯函数测试，再拆流程。
- 状态变更必须通过统一 helper/use case 收敛。
- provider callback 只做解析和分发，不散落业务规则。
- 金额、积分、退款、hold 确认必须有幂等边界。
- 不把异常吞掉；用户可见错误和日志错误要分层处理。

## 测试与验证

常用验证命令：

```bash
bun run typecheck
bun run test
bun run lint
bun run arch:check
git diff HEAD --check
```

局部改动优先跑局部：

```bash
bun run --filter @autix/shared-ui typecheck
bun run --filter @autix/shared-ui test
bun run --filter @autix/api typecheck
bun test path/to/file.spec.ts
```

验收要求：

- typecheck 必须通过。
- 涉及纯 helper 的改动应补最小单测。
- 涉及核心业务流程的改动应跑对应 service/helper spec。
- 每一轮重构结束后统计剩余热点文件和验证结果。

### 禁止无意义的测试与命令

- **不做多余的测试**。只跑与本次改动直接相关的 spec；改了哪个文件就跑哪个 spec，不要为了"保险"跑全量套件。
- 定位失败用 `bun test path/to/one.spec.ts`（秒级出结果），不要用 `bun test src` 或 `bun run test` 扫全量——后者动辄数分钟且淹没真正的失败点。
- **不运行没有意义输出的 shell 命令**。命令必须能直接回答当前问题；不确定能产出什么就不要执行。
- 不为了"确认一下"重复跑已经跑过、结果未变的命令。
- 遇到既有的失败（改动前就红），先用干净 HEAD 确认，然后**如实报告并跳过**，不要顺手去修无关的红。

### 长耗时命令

- 执行前先说明：在等什么、预计多久。不要挂一个静默的后台任务让用户干等。
- 后台命令里管道接 `grep` 会因缓冲而**一直没有输出**；需要过滤时先把原始输出落盘，再单独 grep。
- 不要用轮询/monitor 去等一个可能永远不会出现的信号；等待条件必须同时覆盖成功和失败两种结局。

## Agent 协作规范

- 多 agent 并行时必须明确 disjoint 写入范围。
- agent 之间不得回滚彼此或用户改动。
- agent 不执行 `git add/commit/reset/restore`。
- agent 完成后必须报告改动文件、验证命令、剩余风险。
- 主线程负责集成、最终验证和剩余工作量统计。
