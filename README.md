# ApnaConverter Backend

Microservice-ready backend for API gateway, BullMQ queues, Redis, isolated workers, temp storage, Docker Compose, and Nginx routing.

## Local Commands

```bash
pnpm install
pnpm build
pnpm compose:dev
```

## Services

- `services/api-gateway`: Express API, upload validation, job tracking, download streaming.
- `services/image-worker`: Sharp image conversion and optimization.
- `services/pdf-worker`: pdf-lib, PDFKit, and Ghostscript workflows.
- `services/vector-worker`: Inkscape, UniConvertor, Ghostscript, ImageMagick, and SVGO flows.
- `services/video-worker`: FFmpeg workflows.

## Environment

Copy `.env.example` to `.env` before production compose. Redis is addressed internally as `redis:6379` in Docker and as `localhost:6379` when running services directly.
