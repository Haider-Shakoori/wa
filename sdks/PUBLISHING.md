# RelayWA SDK publication playbook

**Status: unpublished previews.** This document is preparation only. No CI workflow in this repository should automatically publish SDKs or deploy RelayWA services.

## Registry identities to verify before publication

| Ecosystem | Proposed identity | Source | Registry |
| --- | --- | --- | --- |
| npm | `@relaywa/sdk` | `packages/sdk-typescript` | https://www.npmjs.com/ |
| Packagist | `relaywa/sdk` | `sdks/php` | https://packagist.org/ |
| PyPI | `relaywa-sdk` | `sdks/python` | https://pypi.org/ |
| NuGet | `RelayWA.Sdk` | `sdks/dotnet/RelayWA` | https://www.nuget.org/ |

These names are **proposed, not confirmed available or registered**. Package publishing requires account ownership, appropriate repository layout, licenses, metadata, and approval. Packagist generally expects a package at the root of a dedicated VCS repository or an appropriate split/release mechanism; this monorepo subdirectory is not a direct Packagist package URL.

## Required gates before any publishing

1. Verify actual REST API contracts, payloads, auth scopes, error responses, and session routing with backend source, without calling live messaging endpoints.
2. Test SDKs with mocked transport for success, authorization failures, timeouts, invalid input, and non-JSON responses. Validate cross-language compatibility.
3. Review security: no credentials in git, docs, packages, CI logs, or browser bundles; use server-side environment variables only.
4. Decide and verify licenses and package provenance; add appropriate README and package metadata. Resolve npm `private: true` **only** on a reviewed release branch after all gates pass.
5. Confirm ownership and availability of each registry package name. Prepare distinct registry accounts/tokens with least privilege, preferably trusted publishing where supported.
6. Prepare and inspect package artifacts locally or in isolated CI: `pnpm --filter @relaywa/sdk pack`, `python -m build sdks/python`, `dotnet pack sdks/dotnet/RelayWA/RelayWA.csproj`; PHP: validate Composer package in its intended distributable repository.
7. Obtain explicit release approval and publish each ecosystem independently. Verify public registry URLs and installation instructions after release.
8. Only then submit a separate docs-only PR linking to the actual published packages; verify docs build and deployment independently.

## Rollback

A package version is immutable in some registries. Prefer a fixed patch release over unpublishing. Keep the production API, workers, queue, database and deployment configurations out of SDK releases. Never tie SDK publishing to RelayWA service deployments.
