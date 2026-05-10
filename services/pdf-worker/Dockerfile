FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ghostscript libreoffice poppler-utils qpdf && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/pdf-worker ./services/pdf-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/pdf-worker... build
ENV NODE_ENV=production
CMD ["node", "services/pdf-worker/dist/worker.js"]
