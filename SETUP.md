# Cloud Mail - Quick Setup Guide

## Prerequisites
- Node.js >= 18
- pnpm
- Cloudflare account
- Wrangler CLI

---

## Quick Start

### 1. Clone
```bash
git clone <repo-url> && cd cloud-mail
```

### 2. Install Dependencies
```bash
cd mail-worker && pnpm install
cd ../mail-vue && pnpm install
cd ..
```

### 3. Create Cloudflare Resources
```bash
wrangler d1 create cloud-mail
wrangler kv namespace create CLOUD_MAIL_KV
# Optional:
wrangler r2 bucket create cloud-mail
```

### 4. Configure Local Environment
Create your local production config from the example:
```bash
cp mail-worker/wrangler.example.toml mail-worker/wrangler.toml
```

Copy placeholder IDs from the creation commands into:
- `mail-worker/wrangler.toml` (for production; ignored by git)
- `mail-worker/wrangler-dev.toml` (for local dev)

Fill in `[vars]`:
```toml
[vars]
domain = ["example.com"]
admin = "admin@example.com"
jwt_secret = "your-random-secret"
```

Configure frontend API in:
- `mail-vue/env.release`

### 5. Run (Local Dev)

**Terminal 1 - Frontend:**
```bash
cd mail-vue && pnpm dev
```

**Terminal 2 - Worker:**
```bash
cd mail-worker && pnpm dev
```

Access at `http://localhost:5173` (frontend) and `http://localhost:8787` (worker).

---

## Production Setup

1. Update `mail-worker/wrangler.toml` (created from `mail-worker/wrangler.example.toml`):
   - Fill in D1 `database_id`
   - Fill in KV `id`
   - Uncomment `[[r2_buckets]]` if needed
   - Uncomment `[[send_email]]` if using Cloudflare Email Routing

2. Set secrets (recommended):
```bash
cd mail-worker
wrangler secret put jwt_secret
wrangler secret put admin
```

3. Deploy:
```bash
pnpm deploy
```

4. Add custom domain (optional):
```bash
wrangler custom-domain create cloud-mail mail.yourdomain.com
```

---

## Key Commands

| Command | Environment | Purpose |
|---------|-------------|---------|
| `pnpm dev` | Local | Uses `wrangler-dev.toml` |
| `pnpm deploy` | Production | Deploys via local `wrangler.toml` |
| `pnpm test` | Test | Deploys via `wrangler-test.toml` |

---

## Environment Files

| File | Purpose |
|------|---------|
| `wrangler-dev.toml` | Local development with local/test resources |
| `wrangler.example.toml` | Example production config to copy |
| `wrangler.toml` | Local production deployment config; ignored by git |
| `wrangler-test.toml` | Test deployment |
| `wrangler-action.toml` | GitHub Actions CI/CD |
