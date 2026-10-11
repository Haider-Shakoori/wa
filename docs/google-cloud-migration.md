# RelayWA migration: Google Compute Engine for web + API only

**Production source of truth:** GitHub `Haider-Shakoori/wa`. Existing cPanel and VPS remain live until full acceptance. Do not merge or change DNS before tests pass.

## Service boundaries

| Service | Destination |
| --- | --- |
| Next.js 16 frontend | Google Compute Engine, Node.js 22, loopback 3000 |
| NestJS 12 API | **Same** Compute Engine VM, Node.js 22, loopback 3001 |
| TLS + HTTP/2 / HTTP/3 | Caddy on Google VM, public TCP 80/443 + UDP 443 |
| PostgreSQL 17, Redis, WhatsApp Baileys/Chromium worker, QR sessions | **Existing VPS unchanged** |
| Existing SMTP/IMAP inboxes and MX/DKIM | **cPanel unchanged** |
| Domain DNS authority | Existing cPanel DNS (only A for web is changed at final cutover) |

Initial size: `e2-standard-2` (2 vCPU, 8 GiB), 30 GiB balanced disk, Ubuntu 24.04 LTS, **reserved static external IP**. This is a starting point, not a speed guarantee. Benchmark region choice (Mumbai, Delhi, Doha, and ideally the region near the existing VPS), particularly p95 database round-trip and Afghanistan client latency. Use Google Cloud Billing budget alerts. Do not place production secrets in Google instance metadata, GitHub artifacts, or command output.

A dedicated GCE VM is intentional: Cloud Run instances are ephemeral and cannot receive the existing VPS reverse-SSH database socket without a different VPC/VPN design.

## Google Cloud account prerequisites (manual/user-approved)

1. Create/select a Google Cloud **billing-enabled project** and enable the Compute Engine API. Record project **ID**, not an API key.
2. Pick region/zone after measuring both user-to-GCE and GCE-to-VPS latency. Create the VM, reserve a **static public IPv4**, and enable automatic restart, shielded VM, patching and monitoring.
3. Permit TCP 80/443 and UDP 443 on the VM for HTTPS. **Restrict TCP 22 to the existing VPS IP and Google IAP/authorized administrators.** Do not expose 3000/3001/5432/6379/3002/13002/16379.
4. Install **Node.js 22**, Caddy, tar, rsync, OpenSSH, and create a dedicated non-root `relaywa` Linux user. Prefer Google OS Login/IAP for administrator access, with separate least-privilege SSH keys for the VPS tunnel.
5. Prepare directories owned by `relaywa` under `/srv/relaywa` (`releases`, `private/pg`). Provision `/etc/relaywa` directory with mode 0700 and owned by `relaywa`. Unit files belong in `/etc/systemd/system`.

Never give ChatGPT a service-account private key, billing information, account password or payment-card details.

## Staging before production

1. In the **existing cPanel DNS zone**, add `gcp-stage.relaywa.com` A pointing to the Google VM's reserved IP. **Do not change `relaywa.com` yet.** Keep MX and mail records unchanged.
2. Transfer the tested workflow artifact `relaywa-gce-production-candidate` securely; verify all `SHA256SUMS.txt` entries.
3. Extract `relaywa-gcp-web.tar.gz` and `relaywa-gcp-api.tar.gz` into versioned directories under `/srv/relaywa/releases/<release>/web` and `/api`, preserving symlinks. No worker/db/session archives belong on this VM.
4. Create a **dedicated** SSH key on the VPS for the VM. Authorize only the corresponding public key on the VM's `relaywa` account. Enforce owner-only permissions. Store the VM IP and key filename in a private VPS config; never commit keys.
5. On the VM, establish `/srv/relaywa/private/pg` with mode 0700. Run `deploy/gcp/vps-to-gce-tunnel.sh` **on the VPS** with `RELAYWA_GCE_SSH_HOST`, `RELAYWA_GCE_SSH_KEY`, and `RELAYWA_GCE_SSH_USER=relaywa`. Validate PostgreSQL through the Unix socket, Redis via `127.0.0.1:16379` and worker via authenticated `127.0.0.1:13002`. It is not enough to see a socket file; run read-only `SELECT 1`, `PING` and worker authorization checks. Manage the tunnel as a user systemd service with automatic restart/recovery, plus a health check, **after** the private route is proven. Keep the existing cPanel tunnel as a rollback route until cPanel retirement.
6. Securely transfer an **owner-only production environment source copy** from the VPS to the VM (do not alter the original on VPS). Run `node scripts/provision-gcp-env.mjs <source> /etc/relaywa --staging` on the VM. This creates separate `stage-api.env` and `stage-web.env`, with live Stripe disabled. Do not run migrations or seeders.
7. For staging services, use copies of the provided systemd units whose `--env-file` paths reference `stage-api.env` and `stage-web.env`. Start with versioned `current-web` and `current-api` symlinks under `/srv/relaywa`.
8. Hash a staging HTTP password using `caddy hash-password`, store the hash in a **non-public systemd EnvironmentFile** for Caddy, and activate `Caddyfile.staging` (never commit the password or hash). Confirm staging TLS and Basic Auth work, anonymous requests are denied and `X-Robots-Tag` is set.
9. Check read-only API data, login to an approved test account, dashboard, Google/GitHub OAuth callback URLs, QR/session status, actual WhatsApp send/receive, Stripe webhook verification and queue reliability. **Never conduct live paid Stripe transactions or mutate real user sessions without explicit approval.** Check static CSS/fonts and repeat-run mobile Lighthouse from multiple locations.
10. Measure site FCP/LCP/TTFB on Google under the same Lighthouse configuration as the existing cPanel site. Compare cold/warm performance and VPS database query latency. If worse, do not cut over.

## Production cutover (only after staging passes)

1. Verify app secrets (JWT signing, webhook encryption, API keys, OAuth and Stripe) match the existing VPS source; no secret rotation should be needed as part of this move.
2. Re-generate production private configs with `node scripts/provision-gcp-env.mjs <source> /etc/relaywa`. Keep the source file untouched. Production will retain the original Stripe credentials.
3. Switch systemd services to `/etc/relaywa/api.env` and `/etc/relaywa/web.env`. Configure Caddy with `deploy/gcp/Caddyfile`. Confirm direct Google VM access via a safe hostname/hosts override; no TLS bypass as an acceptance test.
4. Check public `/login`, `/pricing`, `/api/health`, `/api/public/plans` and private auth behaviors. Check Stripe and WhatsApp flow with approved test accounts.
5. Snapshot the cPanel DNS zone and old app release paths. Change **only** `relaywa.com` and `www` website A/AAAA records as applicable to Google VM's reserved IP, retaining **all MX/SPF/DKIM/DMARC, mail, and existing staging records**. Prefer TTL 300 during the switch.
6. Observe errors, login success, p95 latency, session events, memory and SSH-tunnel health. Keep cPanel web/API and the entire VPS stack running for a rollback window. Do not stop PostgreSQL/Redis/WhatsApp or delete QR session data.

## Rollback

Restore the exact previous website A/AAAA DNS records (cPanel IP `51.81.56.231` if unchanged). Confirm the cPanel website/API, its private VPS tunnel, and mailboxes are still functional. On the Google VM revert the versioned `current-web`/`current-api` symlinks and restart their services if an application build—not the cloud platform—was at fault. **Never roll back by restoring/overwriting PostgreSQL or WhatsApp session volumes.**

## Cost/performance caveat

Google Cloud improves control over the HTTP stack but does not automatically make a cross-region PostgreSQL request faster. The new Google VM must be benchmarked against both users in Afghanistan and the VPS hosting location. VM, disk, external IP and network egress charges apply. Later options include a regional CDN/HTTP load balancer after the initial split is stable.
