# better-sqlite3 is a native Node addon. It MUST be installed inside this
# Linux image, not copied in from a host node_modules — a macOS/Windows
# build produces a binary that will not load on Linux.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Build tools are a fallback for when better-sqlite3's prebuilt binary
# download doesn't match this exact base image; safe to keep even if unused.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
