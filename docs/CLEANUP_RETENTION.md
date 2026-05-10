# Volume Cleanup & Data Retention Configuration

## Overview
The system automatically cleans up temporary files and expired data to prevent disk space issues. All cleanup is handled automatically without manual intervention.

---

## Cleanup Schedule

### 🧹 Temporary Files (Every 15 Minutes)
- **Cleanup Service**: Runs automatically every 15 minutes
- **Directories Cleaned**: 
  - `/tmp/uploads` - User-uploaded files
  - `/tmp/output` - Conversion results
- **Files Deleted After**: 15 minutes of inactivity
- **Status**: Files not accessed for 15 min are removed automatically

### 🔄 Redis Data Expiration (On-demand)
- **Memory Limit**: 1GB (configurable in docker-compose)
- **Eviction Policy**: `allkeys-lru` (removes least recently used keys)
- **Auto-Cleanup**: When memory limit reached
- **Append-Only**: Changes persisted to disk for recovery

---

## Configuration

### Environment Variables
```env
# Job TTL: How long to keep files before cleanup (minutes)
JOB_TTL_MINUTES=15

# Temporary directories for uploads and outputs
TEMP_UPLOAD_DIR=/tmp/uploads
TEMP_OUTPUT_DIR=/tmp/output
```

### Redis Configuration (docker-compose)
```yaml
redis:
  command: [
    "redis-server",
    "--appendonly", "yes",           # Persist data to disk
    "--maxmemory", "1gb",            # Stop growing at 1GB
    "--maxmemory-policy", "allkeys-lru"  # Remove LRU keys when full
  ]
```

### Cleanup Service (docker-compose)
```yaml
cleanup:
  # Runs cleanup script every 900 seconds (15 minutes)
  command: |
    while true; do
      # Remove files older than 15 minutes
      # Check /tmp/uploads and /tmp/output
      node cleanup-script.js
      sleep 900  # Wait 15 minutes
    done
```

---

## What Gets Cleaned Up

### ✅ Automatically Deleted
1. **Upload files** > 15 minutes old → Removed from `/tmp/uploads`
2. **Output files** > 15 minutes old → Removed from `/tmp/output`
3. **Redis keys** → Removed when memory limit exceeded
4. **Expired jobs** → Cleaned by BullMQ job queue

### ❌ NOT Deleted
1. Redis data volume (persisted in `redis-data` volume)
2. Database backups (if configured)
3. Source code and configs
4. API logs

---

## Timeline Example

**User uploads file at 10:00 AM:**
```
10:00 - File uploaded → /tmp/uploads/job-123.pdf (5MB)
10:15 - Cleanup runs, but file is recent (skip)
10:30 - Cleanup runs, file still active (skip)
10:35 - Conversion completes → /tmp/output/job-123.png created
10:45 - Cleanup runs
         - /tmp/uploads/job-123.pdf (45 min old) → DELETED
         - /tmp/output/job-123.png (10 min old) → KEPT
10:50 - User downloads result (still available)
10:55 - Cleanup runs, file still needed (skip)
11:00 - User leaves page
11:15 - Cleanup runs → /tmp/output/job-123.png (40 min old) → DELETED
```

---

## Monitoring Cleanup

### Check Cleanup Service Logs
```bash
docker compose logs -f cleanup
```

### Check Redis Memory Usage
```bash
docker compose exec redis redis-cli INFO memory
```

### Check Disk Usage
```bash
# See temp directory sizes
du -sh /tmp/uploads /tmp/output

# See Docker volume sizes  
docker volume ls -q | xargs docker volume inspect | grep Mountpoint
```

---

## Manual Cleanup (Emergency)

If you need to manually clean volumes:

```bash
# Stop services first
docker compose down

# Remove all temporary data
docker volume rm temp-uploads temp-output

# Remove Redis data (warning: deletes all jobs)
docker volume rm redis-data

# Restart
docker compose up -d
```

---

## Performance Impact

### Disk Usage (Expected)
| Phase | Uploads | Outputs | Total |
|-------|---------|---------|-------|
| During conversions | ~100MB | ~50MB | 150MB |
| After 15 min cleanup | ~5MB | ~5MB | 10MB |
| After 30 min cleanup | ~0MB | ~0MB | 0MB |

### Memory Usage (Expected)
| Setting | Value |
|---------|-------|
| Redis Max Memory | 1GB |
| Typical Usage | 100-200MB |
| Cleanup Trigger | 1GB limit |

---

## Troubleshooting

### Disk space still growing?
1. Check cleanup service is running: `docker compose ps cleanup`
2. Check logs: `docker compose logs cleanup`
3. Manually trigger cleanup: `docker compose exec cleanup node cleanup.js`

### Redis running out of memory?
1. Check size: `docker compose exec redis redis-cli INFO memory`
2. Force cleanup: `docker compose exec redis redis-cli EVICT`
3. Increase limit in docker-compose: `--maxmemory 2gb`

### Files not being cleaned up?
1. Verify JOB_TTL_MINUTES is set correctly
2. Check file modification times: `ls -la /tmp/uploads/`
3. Check cleanup script is executable

---

## Best Practices

✅ **Do:**
- Keep JOB_TTL_MINUTES at 15-30 minutes
- Monitor disk space weekly
- Use cleanup service in production
- Enable Redis persistence (`--appendonly yes`)

❌ **Don't:**
- Set JOB_TTL_MINUTES < 5 minutes (too aggressive)
- Disable cleanup service
- Disable Redis persistence
- Manually delete volumes during operation
