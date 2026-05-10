# ApnaConverter Backend Architecture

## Execution Flow

Frontend route upload -> `POST /api/jobs/create` -> API Gateway validates tool, MIME, count, and 50MB file policy -> Multer writes to `/tmp/uploads` -> gateway selects queue from `TOOL_CONFIGS` -> BullMQ stores job in Redis -> dedicated worker consumes queue -> output is written to `/tmp/output/<job-scope>` -> frontend polls `GET /api/jobs/:id/status` -> completed jobs expose `GET /api/jobs/:id/download`.

## Queue Routing

| Tool family | Queue | Worker | Concurrency | Timeout |
| --- | --- | --- | --- | --- |
| JPG/PNG/WEBP/compress/resize/crop/watermark | `imageQueue` | `image-worker` | `IMAGE_WORKER_CONCURRENCY=4` | 60-90s |
| merge/split/compress/rotate/jpg-to-pdf/pdf-to-image | `pdfQueue` | `pdf-worker` | `PDF_WORKER_CONCURRENCY=2` | 120-180s |
| CDR preview/CDR export/SVG/EPS/vector optimize | `vectorQueue` | `vector-worker` | `VECTOR_WORKER_CONCURRENCY=1` | 60-240s |
| video compress/MP4/GIF/trim/thumbnail | `videoQueue` | `video-worker` | `VIDEO_WORKER_CONCURRENCY=1` | 180-600s |

BullMQ jobs use 3 attempts, exponential backoff, completion retention, and failure retention for dead-letter inspection.

## API Endpoints

`POST /api/jobs/create`

1. Validate tool slug.
2. Validate file count.
3. Validate MIME allowlist.
4. Persist temporary uploads.
5. Create scoped output directory.
6. Add job to mapped queue.
7. Return `{ jobId, status, queue }`.

`GET /api/jobs/:id/status`

1. Search known queues.
2. Return BullMQ state, progress, error, output name, and download URL when completed.

`GET /api/jobs/:id/download`

1. Verify job exists and is completed.
2. Stream output with attachment headers.

`DELETE /api/jobs/:id`

1. Remove uploaded files.
2. Remove output directory.
3. Remove job record.

## Docker Networking

Compose services share an internal network. Workers and gateway connect to Redis through `redis:6379`. Nginx routes `/api/*` to `api-gateway:8080`; workers are not public.

## Production Notes

The system is anonymous by design. No login, history, or permanent file storage exists. Temp storage should be mounted on ephemeral volumes and cleaned every 15-30 minutes with `scripts/cleanup-temp.ts` via cron, Render scheduled job, or OCI systemd timer.

CDR conversion depends on OS binary support for the uploaded CDR version. Unsupported files fail the job cleanly; the platform does not promise editable CDR or version downgrade behavior.
