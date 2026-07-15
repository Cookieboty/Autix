# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
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

COPY tsconfig.base.json ./
COPY packages/i18n/ packages/i18n/
COPY packages/domain/ packages/domain/
COPY packages/platform/ packages/platform/
COPY packages/sdk/ packages/sdk/
RUN pnpm --filter @autix/i18n build
RUN pnpm --filter @autix/domain build

COPY packages/shared-store/ packages/shared-store/
COPY packages/shared-ui/ packages/shared-ui/
COPY clients/web/ clients/web/

RUN pnpm --filter @autix/web build

FROM node:22-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=builder /app/clients/web/.next/standalone ./
COPY --from=builder /app/clients/web/.next/static ./clients/web/.next/static
COPY --from=builder /app/clients/web/public ./clients/web/public

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "clients/web/server.js"]
