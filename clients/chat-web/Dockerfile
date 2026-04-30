# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/i18n/package.json packages/i18n/
COPY services/chat/package.json services/chat/
COPY services/user-system/package.json services/user-system/
COPY clients/chat-web/package.json clients/chat-web/
COPY clients/admin-web/package.json clients/admin-web/

RUN bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/i18n/ packages/i18n/
RUN cd packages/i18n && bun run build

COPY clients/chat-web/ clients/chat-web/

ARG NEXT_PUBLIC_CHAT_API_URL
ARG NEXT_PUBLIC_USER_API_URL

RUN cd clients/chat-web && bun run build

FROM oven/bun:1-alpine
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
    CMD wget -qO- http://localhost:3002/ || exit 1

CMD ["bun", "run", "clients/chat-web/server.js"]
