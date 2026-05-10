# Build stage
FROM node:22-alpine AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/audio-worker ./services/audio-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/audio-worker... build

# Runtime stage
FROM node:22-alpine
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/audio-worker ./services/audio-worker
CMD ["node", "services/audio-worker/dist/worker.js"]
