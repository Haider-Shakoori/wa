# @relaywa/sdk 0.1.0 — first staged release plan (not authorized)

## This PR is preparation only
- `packages/sdk-typescript/package.json` stays `"private": true`; staging refuses private packages.
- The new `sdk-npm-staged-preflight.yml` workflow is **manual and read-only**: no `id-token: write`, registry tokens, npm stage/publish calls, environments, deployments, or production changes.
- Run the workflow with `PREFLIGHT_ONLY` to validate the isolated build, offline tests, and package inventory. It does **not** reserve the package name or create a stage.
- The existing `sdk-npm-publish.yml` remains inert.

## First publication — separate explicit approval required
1. Check `@relaywa/sdk` availability on the npm registry, verify npm organization ownership, confirm 2FA, and review exact package files, documentation, API behavior and licensing.
2. On a **separate PR**, after owner authorization, deliberately change `private: true` to false and add `publishConfig.access: public`. Review lockfile consistency and rerun checks.
3. Use Node >=22.14.0 and npm >=11.15.0, with a short-lived interactive npm login on the owner's machine. Do not store npm credentials in GitHub Actions.
4. In the isolated built SDK directory, **only after separate staging authorization**, run `npm stage publish --access public`. Do not run `npm publish`.
5. For a new package, npm creates a **public `0.0.0-stage` placeholder**; the staged `0.1.0` content is not public until explicitly approved. This is a registry change and must not be done as part of this PR.
6. Inspect with `npm stage list @relaywa/sdk`, `npm stage view <stage-id>`, and `npm stage download <stage-id>`. Inspect tarball before any approval.
7. Only after another explicit owner decision, use npmjs.com staged package review or `npm stage approve <stage-id>` with 2FA. Approval makes `0.1.0` publicly installable.
8. Once the package exists, configure the GitHub OIDC Trusted Publisher, restricted to **stage-only** (`npm stage publish`, not direct `npm publish`), GitHub owner `Haider-Shakoori`, repo `wa`, workflow `sdk-npm-publish.yml`, environment `sdk-npm-release`. Enable an automated stage workflow only in another reviewed PR.

**Safety:** No production WhatsApp engine, API, workers, sessions, queues, databases, website, deployments, or root lockfile changes.

References: https://docs.npmjs.com/staged-publishing/ ; https://docs.npmjs.com/cli/v11/commands/npm-stage/ ; https://docs.npmjs.com/trusted-publishers/
