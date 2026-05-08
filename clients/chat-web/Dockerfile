# syntax=docker/dockerfile:1

FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/i18n/package.json packages/i18n/
COPY packages/shared-lib/package.json packages/shared-lib/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/chat/package.json services/chat/
COPY services/user-system/package.json services/user-system/
COPY clients/chat-web/package.json clients/chat-web/
COPY clients/admin-web/package.json clients/admin-web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/types/ packages/types/
COPY packages/i18n/ packages/i18n/
RUN cd packages/types && bun run build
RUN cd packages/i18n && bun run build

COPY packages/shared-lib/ packages/shared-lib/
COPY packages/shared-store/ packages/shared-store/
COPY packages/shared-ui/ packages/shared-ui/
COPY clients/chat-web/ clients/chat-web/

ARG NEXT_PUBLIC_CHAT_API_URL
ARG NEXT_PUBLIC_USER_API_URL

RUN cd clients/chat-web && bun run build

FROM oven/bun:1.3.11-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=builder /app/clients/chat-web/.next/standalone ./
COPY --from=builder /app/clients/chat-web/.next/static ./clients/chat-web/.next/static
COPY --from=builder /app/clients/chat-web/public ./clients/chat-web/public

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3002
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3002/ || exit 1

CMD ["bun", "run", "clients/chat-web/server.js"]
