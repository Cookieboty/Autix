请在当前仓库从零搭建一个 Bun workspaces monorepo，结构与要求如下，并严格按顺序完成（先底座，再 web，再 api，再联通，再 compose）。

要求：

1. 根目录：
    - 目录：clients/ services/ packages/contracts/src infra/compose
    - package.json：workspaces=clients/*, services/*, packages/*；scripts 包含 dev/dev:web/dev:chat/build/typecheck；packageManager=bun@<你的版本>
    - bunfig.toml：linker="isolated"
    - turbo.json：dev 不缓存且 persistent；build dependsOn ["^build"] 且 outputs 包含 dist/ **和 .next/**
    - tsconfig.base.json：配置 paths，@repo/contracts 指向 packages/contracts/src/index.ts
2. packages/contracts：
    - package.json + tsconfig.json + src/index.ts
    - 导出常量 APP_NAME="llm"
3. clients/web（Next）：
    - 初始化 Next（app router）
    - package.json name=@repo/web，依赖引用 "@repo/contracts":"workspace:*"
    - next.config.ts 必须设置 transpilePackages=["@repo/contracts"], output="standalone", outputFileTracingRoot
    - app/page.tsx 显示 "Hello from ${APP_NAME}"
4. services/chat（Nest）：
    - 初始化 Nest
    - package.json name=@repo/chat，依赖引用 "@repo/contracts":"workspace:*"
    - 监听端口 3001
    - GET /health 返回 { ok: true }
    - GET /hello 返回 { message: `Hello from Chat, shared APP_NAME=${APP_NAME}` }
5. Web 调用 Chat：
    - Web 页面加按钮，点击后 fetch /hello 并展示返回 message
    - 处理跨域：优先使用 Next rewrites 把 /api/ *转发到 http://localhost:3001/*，并把前端请求写成 fetch("/api/hello")
6. Compose：
    - infra/compose/compose.yaml：web:3000, chat:3001；chat healthcheck 访问 /health；web depends_on chat service_healthy
    - 允许开发覆盖文件 `compose.dev.yaml`（挂载源码）

交付要求：

- 生成所有必要文件
- 根目录 `bun install`、`bun run dev` 可运行
- 打开 http://localhost:3000，点击按钮能展示 API 返回 message
- 每一步完成后，输出你修改/新增了哪些文件（按步骤 1→6 汇报）。