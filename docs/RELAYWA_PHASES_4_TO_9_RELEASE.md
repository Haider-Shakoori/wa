# RelayWA Phases 4–9: GitHub-first release checklist

**Deployment policy:** no VPS changes, migrations, or restarts until all phase acceptance criteria are met and GitHub checks are green on the exact intended release commit.

## Phase 4 — Platform security and administration
- [x] Audit session connect, restart and logout commands atomically, retaining administrator identity.
- [ ] Audit engine changes, safety controls, provider configuration, manual approvals and other administrative mutations.
- [ ] Add server-side filtered/paginated audit queries and secret-redaction policy.
- [ ] Introduce scoped admin permissions / two-person approval for high-risk changes.
- [ ] Add tenant suspension controls, clear operator feedback and permission tests.

## Phase 5 — Analytics and observability
- [ ] Historical success/failure rates, latency and session uptime with clearly defined denominators.
- [ ] Tenant growth, subscriptions, revenue and retention with date-range selectors and exports.
- [ ] Monitor queue backlogs and alerting thresholds; acknowledge/resolve workflows.
- [ ] Prove query bounds, tenant scoping, timezone handling and performance under realistic volume.

## Phase 6 — Subscriptions and billing
- [ ] Renewal and expiration notices, proration policy and lifecycle reconciliation.
- [ ] Payment idempotency, invoices, refunds/chargebacks and failed-payment flows.
- [ ] Coupons and configurable quotas with server-enforced audit trails.
- [ ] Validate Stripe/manual pathways and failure/retry behavior.

## Phase 7 — Tenant UX
- [ ] Preserve and compare Raysultan's tenant UI before editing; no resets.
- [ ] End-to-end login, register, Google/GitHub OAuth, dashboard-first returning login.
- [ ] API docs account-aware navigation, tenant onboarding as a separate flow.
- [ ] Responsive, keyboard accessible and low-bandwidth-friendly pages.

## Phase 8 — Messaging reliability/scaling
- [ ] Session ownership and recovery under worker restarts/network outages.
- [ ] No unintended QR logout or cross-tenant authentication/session leakage.
- [ ] Message dispatch idempotency, bounded retries, backpressure, webhook delivery guarantees.
- [ ] Load tests and observability for 100+ tenant sessions; practical anti-spam safety constraints.
- [ ] No promise of freedom from WhatsApp account restrictions.

## Phase 9 — Release gate
- [ ] GitHub CI: lint/typecheck/unit/integration/build/dependency audit.
- [ ] Browser journeys using test credentials: platform, tenant, docs, OAuth fallback.
- [ ] Database migrations up/down or restore path on disposable environment.
- [ ] Security checks: authorization, secrets, CSRF/OAuth, rate limits, audit integrity.
- [ ] Load/soak, backup/restore and rollback tests.
- [ ] Release freeze on an exact commit SHA; all required GitHub checks green.
- [ ] Only then request/execute a minimal monitored VPS deployment, preserving volumes and sessions.

## Release rule
A successful compile alone is **not** a green release. Each phase needs evidence from passing GitHub checks plus feature acceptance. Treat this branch as incomplete until all boxes above are satisfied.
