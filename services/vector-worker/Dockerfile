FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends inkscape imagemagick ghostscript python3 python3-pip && pip3 install --no-cache-dir uniconvertor && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/vector-worker ./services/vector-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/vector-worker... build
ENV NODE_ENV=production
CMD ["node", "services/vector-worker/dist/worker.js"]
