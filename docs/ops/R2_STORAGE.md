# KPATA AI - R2 Storage Operations Guide

## Buckets Overview

| Bucket | Purpose | Lifecycle | Access |
|--------|---------|-----------|--------|
| `kpata-raw-upload` | Raw user uploads | **7 days** auto-delete | Private (API/Worker only) |
| `kpata-public-gallery` | Processed images | **365 days** auto-delete | Via Media Worker (token required) |

## Key Structure

### Raw Upload Bucket (`kpata-raw-upload`)
```
uploads/{YYYY}/{MM}/{userId}/{jobId}.jpg
```

Example:
```
uploads/2026/01/user_abc123/job_xyz789.jpg
```

### Gallery Bucket (`kpata-public-gallery`)
```
gallery/{userId}/{jobId}/v{pipelineVersion}/{variant}.webp
gallery/{userId}/{jobId}/v{pipelineVersion}/thumb_{size}.webp
```

Variants:
- `original.webp` - Full resolution processed image
- `optimized.webp` - Optimized for web delivery
- `thumbnail.webp` - Default thumbnail
- `thumb_64.webp`, `thumb_128.webp`, `thumb_256.webp`, `thumb_512.webp` - Size-specific thumbnails

Example:
```
gallery/user_abc123/job_xyz789/v1/original.webp
gallery/user_abc123/job_xyz789/v1/thumb_256.webp
```

## Lifecycle Rules Configuration

### Cloudflare Dashboard Setup

1. Go to **R2 > kpata-raw-upload > Settings > Object lifecycle rules**
2. Add rule:
   - **Rule name**: `auto-delete-7-days`
   - **Prefix**: (leave empty for all objects)
   - **Action**: Delete objects
   - **Days after upload**: `7`

3. Go to **R2 > kpata-public-gallery > Settings > Object lifecycle rules**
4. Add rule:
   - **Rule name**: `auto-delete-365-days`
   - **Prefix**: (leave empty for all objects)
   - **Action**: Delete objects
   - **Days after upload**: `365`

### Verification Checklist

- [ ] `kpata-raw-upload` bucket created
- [ ] `kpata-raw-upload` lifecycle rule: 7 days delete
- [ ] `kpata-public-gallery` bucket created
- [ ] `kpata-public-gallery` lifecycle rule: 365 days delete
- [ ] R2 API tokens created with read/write permissions
- [ ] Environment variables configured in API and Worker services

## Metadata

All uploads include the following metadata:

| Key | Description |
|-----|-------------|
| `correlation-id` | Request correlation ID for tracing |
| `pipeline-version` | (Gallery only) Processing pipeline version |
| `thumbnail-size` | (Thumbnails only) Size in pixels |

### Verifying Metadata

Using wrangler:
```bash
wrangler r2 object get kpata-public-gallery/gallery/user123/job456/v1/original.webp --pipe > /dev/null
```

Or via API HEAD request - the `correlation-id` will be returned in `X-Correlation-Id` header.

## Access Control

### Raw Upload Bucket
- **No public access**
- Access via API/Worker services only using S3-compatible API
- Credentials stored in environment variables

### Gallery Bucket
- **No direct public access** (no presigned URLs on custom domain)
- Access via Media Worker at `media.kpata.ai`
- Requires HMAC-signed token with:
  - User ID validation
  - Path prefix validation
  - 10-minute expiry

## Media Worker Routes

| Route | Description |
|-------|-------------|
| `GET /health` | Health check |
| `GET /gallery/{path}?token=...` | Serve gallery image |
| `GET /thumb/{size}/gallery/{path}?token=...` | Serve thumbnail (64/128/256/512) |

## Environment Variables

### API Service (`services/api/.env`)
```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_PUBLIC_URL=https://media.kpata.ai
MEDIA_WORKER_URL=https://media.kpata.ai
MEDIA_TOKEN_SECRET=your-hmac-secret-min-32-chars
```

### Worker Service (`services/worker/.env`)
```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_PUBLIC_URL=https://media.kpata.ai
```

### Media Worker (`services/media-worker`)
Set via `wrangler secret put`:
```bash
wrangler secret put MEDIA_TOKEN_SECRET
```

## Monitoring

### Key Metrics to Watch
- Upload success/failure rate
- Average upload duration
- Storage usage per bucket
- Token validation failures (potential abuse)

### Alerts to Configure
- Storage approaching quota
- High rate of 403 errors (unauthorized access attempts)
- Upload latency > 5s
