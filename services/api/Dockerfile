# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ai-adapters/package.json packages/ai-adapters/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/i18n/package.json packages/i18n/
COPY packages/platform/package.json packages/platform/
COPY packages/sdk/package.json packages/sdk/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/api/package.json services/api/
COPY clients/web/package.json clients/web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
COPY services/api/ services/api/

RUN pnpm --filter @autix/i18n build
RUN pnpm --filter @autix/domain build
RUN pnpm --filter @autix/database build
RUN pnpm --filter @autix/ai-adapters build

# nest 现在用 SWC 编译（typeCheck: false），只转译不校验类型 —— 以前 tsc 构建时会拦住
# 类型错误，现在不会。这一步把那道闸门放回来：镜像构建通过 ⇒ 类型是干净的。
RUN pnpm --filter @autix/api run typecheck
RUN pnpm --filter @autix/api run build

# --- Production dependencies (API + its workspace closure only) ---
# `--filter @autix/api...` installs the API and everything it depends on, so the
# web/desktop trees (Next, Electron) never land here.
FROM node:22-slim AS prod-deps
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ai-adapters/package.json packages/ai-adapters/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/i18n/package.json packages/i18n/
COPY packages/platform/package.json packages/platform/
COPY packages/sdk/package.json packages/sdk/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/api/package.json services/api/
COPY clients/web/package.json clients/web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @autix/api...

# --- Runtime ---
FROM node:22-slim
RUN corepack enable pnpm && \
    apt-get update && \
    apt-get install -y --no-install-recommends wget curl openssl && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/prisma.config.ts ./packages/database/prisma.config.ts
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/scripts ./packages/database/scripts

COPY --from=builder /app/packages/domain/package.json ./packages/domain/package.json
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/i18n/package.json ./packages/i18n/package.json
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist
COPY --from=builder /app/packages/ai-adapters/package.json ./packages/ai-adapters/package.json
COPY --from=builder /app/packages/ai-adapters/dist ./packages/ai-adapters/dist

COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/scripts ./services/api/scripts
COPY --from=builder /app/services/api/package.json ./services/api/package.json

# Workspace packages: ensure node_modules links point to actual dist content
RUN mkdir -p node_modules/@autix && \
    rm -rf node_modules/@autix/domain node_modules/@autix/i18n node_modules/@autix/ai-adapters node_modules/@autix/database && \
    ln -s /app/packages/domain node_modules/@autix/domain && \
    ln -s /app/packages/i18n node_modules/@autix/i18n && \
    ln -s /app/packages/ai-adapters node_modules/@autix/ai-adapters && \
    ln -s /app/packages/database node_modules/@autix/database

# The CMD runs `db:prepare-cutover`, whose steps shell out to prisma, tsx and
# dotenv — all devDependencies, which `--prod` above excludes. Install them
# explicitly here, or the migration chain dies at container start.
#
# The prisma CLI version is derived from the @prisma/client actually installed:
# Prisma refuses to run when the two drift, and hardcoding a version here would
# silently rot the moment the lockfile resolves a new patch.
#
# PNPM_HOME 必须显式设置且进 PATH：pnpm 的 `add -g` 会先校验全局 bin 目录是否
# 在 PATH 中，不在就直接报错退出（"Run pnpm setup to update your shell
# configuration"）。容器里没有交互式 shell 配置，只能在这里声明。Bun 时代没有
# 这一步，是 pnpm 迁移遗留。
ENV PNPM_HOME=/usr/local/share/pnpm
# 注意是 ${PNPM_HOME}/bin 而非 ${PNPM_HOME}：pnpm 11 的全局 bin 目录在 PNPM_HOME
# 下面的 bin 子目录，报错信息里的路径就是这么给的。
ENV PATH="${PNPM_HOME}/bin:${PATH}"
RUN PRISMA_VERSION="$(node -p "require('/app/node_modules/@prisma/client/package.json').version")" && \
    TSX_VERSION="$(node -p "require('/app/package.json').devDependencies.tsx")" && \
    DOTENV_VERSION="$(node -p "require('/app/package.json').devDependencies['dotenv-cli']")" && \
    pnpm add -g "prisma@${PRISMA_VERSION}" "tsx@${TSX_VERSION}" "dotenv-cli@${DOTENV_VERSION}"

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules

# pnpm 11 在执行 `pnpm run` 前会校验 node_modules 与 lockfile 是否一致
# （runDepsStatusCheck）。本镜像的 node_modules 是手工拼装的 —— 根目录来自
# prod-deps 阶段的 `--prod --filter @autix/api...`，加上上面几条指向 dist 的
# 软链 —— 与「完整 workspace 安装」的预期天然不符，于是 pnpm 判定需要清空重装，
# 而容器里没有 TTY 可供确认，直接中止：
#   [ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]
# 报错文案建议的 CI=true / confirmModulesPurge=false 都是「不再询问、直接删了重装」，
# 会在容器启动时全量联网重装并毁掉上面的软链结构。这里改为跳过该校验。
# CMD 里的 db:prepare-cutover 串了 6 个 pnpm run，每个都会触发，绕不开。
ENV npm_config_verify_deps_before_run=false
WORKDIR /app/services/api
RUN echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./dist/*"]}}}' > tsconfig.json
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4100/api/auth/health || exit 1

CMD ["sh", "-c", "cd /app/packages/database && pnpm run db:prepare-cutover && cd /app/services/api && node dist/main.js"]
