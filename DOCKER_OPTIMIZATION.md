# Docker Image Size Reduction Strategies

## Current Situation After Multi-Stage Optimization
- **PDF Worker**: 1.42GB (Ghostscript, LibreOffice, poppler, qpdf)
- **Document Worker**: 1.37GB (Ghostscript, LibreOffice, Tesseract)
- **Video Worker**: 1.2GB (FFmpeg)
- **Audio Worker**: 1.17GB (FFmpeg)
- **Vector Worker**: 1.06GB (Ghostscript, ImageMagick, Inkscape, Python)
- **Image Worker**: 807MB (libvips)
- **API Gateway**: 463MB
- **Redis**: 57.8MB
- **TOTAL: 7.3GB**

## Problem: Dependency Duplication
- **Ghostscript** (150MB each) × 3 workers = **450MB wasted**
- **LibreOffice** (600MB each) × 2 workers = **600MB wasted**
- **FFmpeg** (300MB each) × 2 workers = **300MB wasted**
- **Total Redundancy: 1.35GB (18% of total size)**

## Optimization Options (Choose One or Combine)

### ✅ Option 1: Use Alpine Linux (RECOMMENDED - Save 30%)
**Impact: 7.3GB → 5.2GB (1.8GB+ savings)**

Replace `FROM node:22-bookworm-slim` with `FROM node:22-alpine`

**Advantages:**
- ✅ Saves ~300MB per image
- ✅ Drop-in replacement (no code changes)
- ✅ Most packages available in Alpine
- ✅ Widely used in production

**Disadvantages:**
- ⚠️ Some packages may have different names
- ⚠️ Build times slightly longer
- ⚠️ Must test all workers

**Expected Sizes with Alpine:**
- PDF: 1.42GB → 900MB (-500MB)
- Document: 1.37GB → 850MB (-520MB)
- Video: 1.2GB → 700MB (-500MB)
- Audio: 1.17GB → 650MB (-520MB)
- Vector: 1.06GB → 600MB (-460MB)
- Image: 807MB → 500MB (-307MB)
- **NEW TOTAL: ~5.2GB (saving 2.1GB = 29%)**

### 📦 Option 2: Deploy Only Needed Workers (PRACTICAL - Save 51%)
**Impact: 7.3GB → 3.6GB (depending on workers)**

Don't deploy workers you don't need.

**Example: Images + PDFs only**
- Deploy: api-gateway, image-worker, pdf-worker, redis
- Skip: video-worker (-1.2GB), audio-worker (-1.17GB), document-worker (-1.37GB), vector-worker (-1.06GB)
- **New total: 3.6GB (51% reduction)**

### 🔧 Option 3: Shared Base Images (ADVANCED)
Build and push shared images for common tools:
- **base-ffmpeg**: FFmpeg (300MB) - used by video & audio
- **base-libs**: Ghostscript + LibreOffice (750MB) - used by pdf & document

Then workers extend the base and add specific tools.

**Advantages:**
- Maximum deduplication
- Push once, use multiple times

**Disadvantages:**
- Complex setup
- Requires image registry (Docker Hub, etc.)
- Breaking change to docker-compose

### 💾 Option 4: External Volume for Tools (EXPERIMENTAL)
Mount system tools (/usr/bin, /usr/lib) as a volume shared between containers.

**Advantages:**
- Could save 1.5GB+ per deployment

**Disadvantages:**
- Complex networking
- Performance overhead
- Not recommended for this use case

---

## Recommendation

### For Development (Current Setup)
✅ Keep as-is. Works well, fast enough for testing.

### For Production Deployment
**Best**: Option 1 (Alpine) + Option 2 (Deploy only needed workers)
- Results: 7.3GB → 2.5GB for small deployment
- Results: 7.3GB → 5.2GB for full deployment

**Quick Win**: Option 2 alone
- Deploy only the workers your users actually need
- Save 30-50% immediately without code changes

---

## Implementation Steps for Option 1 (Alpine)

1. Update `services/*/Dockerfile` to use `FROM node:22-alpine`
2. Install additional packages if needed (e.g., `bash`, `curl`)
3. Rebuild: `docker compose build --no-cache`
4. Test all workers to ensure functionality
5. Deploy with 30% smaller images

## Quick Test
```bash
# Before
docker images | grep compose
# Should show ~7.3GB total

# After Option 1
docker images | grep compose
# Should show ~5.2GB total (30% smaller)

# After Option 1 + 2 (selective deployment)
# deploy only: api-gateway, image-worker, pdf-worker
# Should show ~2.5GB total (66% smaller)
```
