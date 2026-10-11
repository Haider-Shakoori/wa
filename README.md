# RelayWA

A self-hosted, developer-focused WhatsApp session and messaging API platform with isolated session workers, queues, webhooks and multi-tenant SaaS controls.

## Batch 1 — Foundation

- NestJS API (`apps/api`)
- Next.js dashboard (`apps/web`)
- isolated session worker package (`apps/worker`)
- PostgreSQL + Redis via Docker Compose
- pnpm workspace
- GitHub Actions validation for typecheck, tests, builds, and Docker Compose

## Local development

```bash
cp .env.example .env
corepack enable
corepack prepare pnpm@12.9.1 --activate
pnpm install
pnpm dev
```

Infrastructure:

```bash
docker compose up -d postgres redis
```

API health endpoint: `GET /api/health`

## Architecture rule

WhatsApp session runtimes are isolated from the public API process. Later batches will add durable session ownership, QR lifecycle, reconnection, messaging, webhooks, quotas, and horizontal worker scaling without changing the public gateway contract.

## Production hosting and configuration

- [cPanel + Cloudflare Free + VPS architecture and runbook](docs/cpanel-migration.md)
- [Cloudflare Free DNS/SSL snapshot (sanitized, non-importable example)](deploy/cloudflare/zone-config.example.json)
- [cPanel Apache text compression snippet](deploy/cpanel/relaywa-compression.htaccess)
- [Google Analytics GA4 admin reporting integration](docs/google-analytics-reporting.md)

**Operational boundary:** Only the Next.js website and NestJS API run on cPanel. PostgreSQL, Redis, WhatsApp/Baileys workers and session credentials remain on the original VPS. Keep all cloud credentials, private environment files and SSH keys *outside this repository*. Production is not deployed automatically from an unreviewed branch.
