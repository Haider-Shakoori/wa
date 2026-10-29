# RelayWA npm SDK publishing preparation — disabled

## Verified account and package identity
- npm organization: `relaywa` (user confirmed owner and 2FA enabled).
- Intended package: `@relaywa/sdk` version `0.1.0`.
- GitHub repository: `Haider-Shakoori/wa`.
- SDK source: `packages/sdk-typescript`; npm-local `package-lock.json` is committed.
- GitHub environment already configured: `sdk-npm-release` (main-only branch restriction; no required reviewers).

## Current safety controls
`.github/workflows/sdk-npm-publish.yml` is a **non-publishing preparation stub**:
- It has **no manually runnable, push, tag, release, or scheduled trigger**.
- Its only callable job is guarded by `enable_publishing == false`; passing true runs no jobs.
- It requests `contents: read` only, **not** `id-token: write`.
- It has **no `npm publish` command**, no registry token, and no publishing environment.
- It verifies `@relaywa/sdk` still has `private: true`, builds in an isolated directory using `npm ci`, runs offline tests, and checks package contents.

**Merging this PR cannot publish any package.** Do not set npm tokens, create registry secrets, or modify production services as part of preparation.

## Separate, explicitly authorized first-publication work
1. Confirm `@relaywa/sdk` package name availability and ownership, and review README, license, release contents, and security implications.
2. Confirm whether npm permits trusted publishing for a brand-new package. If initial publication requires a different bootstrap method, use a separately approved one-time process; never assume GitHub account linking is sufficient.
3. In a **new PR**, deliberately remove the `private: true` safeguard, decide whether to add `publishConfig.access: public`, and configure a manual publishing workflow, npm authentication, branch/commit checks, and GitHub environment protection. Publishing should require explicit user authorization.
4. Verify npm Trusted Publisher configuration matches the actual workflow file name `sdk-npm-publish.yml`, owner `Haider-Shakoori`, repository `wa`, and environment `sdk-npm-release`, if supported by the registry.
5. Never touch root `pnpm-lock.yaml`, WhatsApp engine, API, workers, queues, sessions, databases, or production deployments.

## Dry run
Existing `SDK release candidate (build only)` and `SDK release readiness (no publishing)` workflows already passed on main. They remain the recommended runnable pre-release checks until a separately approved publishing workflow exists.
