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

### 4. Configure Local & Production Environments
Create your configuration files from the example:
```bash
# For production deployment (ignored by git):
cp mail-worker/wrangler.example.toml mail-worker/wrangler.toml

# For local development (ignored by git):
cp mail-worker/wrangler.example.toml mail-worker/wrangler-dev.toml
```

Copy the resource IDs (KV, D1, R2) from the creation commands into both configuration files.

Fill in `[vars]` in both files:
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
# Optional, only if using OpenAI-compatible fallback for verification code recognition:
wrangler secret put ai_fallback_api_key
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

| File | Purpose | Git tracked? |
|------|---------|--------------|
| `wrangler.example.toml` | Template to copy from. Contains placeholder values only. | Yes |
| `wrangler.toml` | Your local production deploy config. Copy from `wrangler.example.toml`. | No (ignored) |
| `wrangler-dev.toml` | Your local development config. Copy from `wrangler.example.toml`. | No (ignored) |
| `wrangler-test.toml` | Test environment deploy config. | Yes |
| `wrangler-action.toml` | GitHub Actions CI/CD template (uses `${VAR}` substitution). | Yes |

Always copy `wrangler.example.toml` for both your production (`wrangler.toml`) and local dev (`wrangler-dev.toml`) configs. Both are git-ignored, so credentials and IDs stay out of the repo.

---

## AI Verification Code Recognition

Cloud Mail can extract verification codes from incoming emails using Workers AI, with an optional fallback to any OpenAI-compatible provider (OpenRouter, OpenAI, etc.) when Workers AI fails or is unavailable.

Settings live in the `[vars]` block of each `wrangler*.toml`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ai_model` | No | Workers AI model. Leave empty (`""`) or omit to use the default `@cf/meta/llama-3.1-8b-instruct`. |
| `ai_fallback_base_url` | No | OpenAI-compatible base URL, e.g. `https://openrouter.ai/api/v1`. Leave empty to disable fallback. |
| `ai_fallback_model` | No | Model name on the fallback provider, e.g. `openai/gpt-4o-mini`. |
| `ai_fallback_api_key` | No | **Set as a secret**, not in `wrangler.toml`. Run `wrangler secret put ai_fallback_api_key`. Keep the line commented out (or remove it) in `wrangler.toml` so the var does not override the secret. |

The fallback only triggers when Workers AI returns nothing, and only runs when **all three** fallback variables (`base_url`, `model`, `api_key`) are configured.
