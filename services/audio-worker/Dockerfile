FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/audio-worker ./services/audio-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/audio-worker... build
ENV NODE_ENV=production
CMD ["node", "services/audio-worker/dist/worker.js"]
