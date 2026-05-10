# Build stage
FROM node:22-alpine AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/vector-worker ./services/vector-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/vector-worker... build

# Runtime stage - only includes Vector-specific tools
FROM node:22-alpine
ENV NODE_ENV=production
RUN apk add --no-cache \
  inkscape \
  imagemagick \
  ghostscript \
  python3 \
  py3-pip && \
  py3-virtualenv && \
  python3 -m venv /opt/venv && \
  /opt/venv/bin/pip install --no-cache-dir uniconvertor

ENV PATH=/opt/venv/bin:$PATH

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/vector-worker ./services/vector-worker
CMD ["node", "services/vector-worker/dist/worker.js"]
