# RelayWA SDK release checklist

This is a source-only release preparation plan. **Do not publish or deploy automatically.**

## CI gates
- [ ] TypeScript: pnpm --filter @relaywa/sdk test and typecheck
- [ ] Python: PYTHONPATH=sdks/python python -m unittest discover -s sdks/python/tests -v
- [ ] PHP: php -l sdks/php/src/Client.php && php sdks/php/tests/smoke.php
- [ ] .NET: dotnet build sdks/dotnet/RelayWA/RelayWA.csproj -c Release
- [ ] Run offline mock contract tests (no production WhatsApp requests)
- [ ] Review package metadata, license, supported runtimes, and security
- [ ] Review exact REST request/response shapes, errors, media, and webhook signatures
- [ ] Approve registry package names and release credentials
- [ ] Publish to npm, Packagist, PyPI, NuGet separately, after approval
- [ ] Only then update RelayWA website with verified package links

## Safety constraints
No changes to API, worker, queues, database, live deployment or production keys. No automatic package publishing on merge. SDKs remain preview until verified.

## Verified dry-run baseline (2026-10-29)

- [x] GitHub Actions CI and SDK package dry run passed for PR #178.
- [x] TypeScript npm package content inspection, Python wheel build, PHP Composer metadata validation, and .NET NuGet archive inspection.
- [x] Offline session lifecycle contracts in TypeScript, Python, PHP validation, and .NET.
- [ ] Reconcile the root pnpm lockfile with the declared pnpm version. The current dry run uses `--no-frozen-lockfile`, which is not reproducible release installation.
- [ ] Install each generated artifact into a clean external consumer project and run no-network smoke tests.
- [ ] Confirm ownership/availability of `@relaywa/sdk`, `relaywa-sdk`, `relaywa/sdk` and `RelayWA.Sdk` before publication.
- [ ] Verify registry-ready licensing, readme, provenance, package contents, changelog and version tags.
- [ ] Explicitly authorize each registry publication; npm currently has `private: true`.

## Operational cautions

Do not include live session keys in CI or package archives. Do not automatically retry send operations or session mutations after ambiguous network failures. Offline tests and package builds do not prove compatibility with live production endpoints.

## Manual release-candidate gate

Run **SDK release candidate (build only)** from GitHub Actions with the confirmation input `PREPARE_ONLY`. This workflow runs offline tests, builds four SDK distribution artifacts and a SHA256 manifest, and uploads them for human review. It has read-only repository permissions, no registry tokens, and no publishing steps. A green run is **not** publication approval.

Before any future publishing workflow is introduced, explicitly configure a protected GitHub Actions environment with required reviewers, confirm registry account ownership and permissions, review artifacts and SHA256 hashes, and obtain separate approval for each registry. A confirmation text field alone is not an enforced reviewer approval gate. Keep npm `private: true` until explicit publication approval. The SDK-only isolated npm build does not modify the monorepo pnpm lockfile, but is not yet fully dependency-lockfile reproducible.
