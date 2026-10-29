# First npm release of @relaywa/sdk — operator checklist (NOT AUTHORIZED)

This document is a plan, not permission to publish. The npm SDK remains `"private": true`. No publishing command or registry credential is added to CI by this change.

## Prerequisites
- npm organization `relaywa` exists; the account owner has 2FA enabled (confirmed by the operator).
- The package `@relaywa/sdk` is not yet published; verify registry availability immediately before release.
- Review the public SDK API, README, MIT license, exact npm tarball contents, and dependency metadata.
- Keep production WhatsApp engine, API, workers, queues, databases, sessions, deployments, and root pnpm lockfile untouched.
- Existing build-only SDK release-candidate workflow succeeded on `main`.
- Publishing approval is separate from PR merge approval. **Do not infer authorization from merging this document.**

## npm first-publication limitation
npm Trusted Publisher configuration normally requires the package to exist on npm already. Connecting a GitHub login to npm or owning `@relaywa` is not sufficient to publish by OIDC.

For a first release, a human owner must explicitly approve a one-time bootstrap publication method (interactive npm CLI with 2FA, or an explicitly approved staged publication path). **Do not create or store long-lived npm tokens by default.**

Staging a new package can create a publicly visible placeholder before approval; it is **not** a completely private dry run.

## After explicit authorization, in a separate reviewed change
1. Change `packages/sdk-typescript/package.json` from `"private": true` to `false`, and add `"publishConfig": {"access": "public"}`. Review the SDK-local lockfile for package metadata consistency if needed.
2. Build only the SDK in an isolated directory with `npm ci --ignore-scripts --no-audit --no-fund`, run offline tests, inspect `npm pack --dry-run --json`, and ensure no secrets or internal files are included.
3. Use an approved bootstrap path for version `0.1.0`, with interactive 2FA and explicit owner confirmation. Do not perform the publication from an automated workflow until separately authorized.
4. Confirm `https://www.npmjs.com/package/@relaywa/sdk` and owner permissions after the first publication.
5. Set up the npm Trusted Publisher for GitHub Actions: GitHub owner `Haider-Shakoori`, repository `wa`, workflow filename `sdk-npm-publish.yml`, environment `sdk-npm-release`. Newly created trust configurations expire if not validated by a successful publish within 48 hours.
6. In a **new, separately approved PR**, replace the inert publishing preparation stub with a manual, restricted, OIDC-based workflow using Node 24+, `id-token: write`, no dependency cache, exact branch and version validation, and preferably stage-only publishing. Verify repository metadata matches the GitHub source.
7. After trusted publishing works, restrict traditional npm token-based publishing and review release environment protections.

## Important: Current workflow is inert
`.github/workflows/sdk-npm-publish.yml` has no manual publishing trigger, no npm publish or stage publish command, and no OIDC publishing permissions. Leave it that way until the separately authorized release change.

Sources: https://docs.npmjs.com/trusted-publishers/ and https://docs.npmjs.com/cli/v11/commands/npm-trust/ and https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/
