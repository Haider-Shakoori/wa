# RelayWA SDK release environment setup

**No SDK registry publication is authorized by this document.** Do not add registry tokens or enable publishing yet.

## GitHub repository setup

Open **Settings → Environments → New environment** in `Haider-Shakoori/wa`. Create these four environments separately:

| Environment | Intended registry | Package |
| --- | --- | --- |
| `sdk-npm-release` | npm | `@relaywa/sdk` |
| `sdk-pypi-release` | PyPI | `relaywa-sdk` |
| `sdk-packagist-release` | Packagist | `relaywa/sdk` |
| `sdk-nuget-release` | NuGet | `RelayWA.Sdk` |

For **each** environment:

1. Enable **Required reviewers** and choose an authorized reviewer. Where available, enable **Prevent self-reviews**.
2. Under **Deployment branches and tags**, restrict deployments to `main` only (use **Selected branches and tags** with `main`, or an equivalent branch policy).
3. Do **not** add registry credentials yet. Never put publishing credentials into repository-wide secrets or source code.
4. If GitHub does not offer required reviewers on the repository's plan, **stop**: the environment is not approval-protected. Use an organization/repository configuration that supports reviewer gates before enabling any publishing job.
5. Keep npm package `private: true` until a separate explicit authorization to publish.

## Verify without publishing

Run **SDK release approval preflight (no publishing)** from GitHub Actions. Review its uploaded `sdk-release-approval-audit` report. It is read-only and reports whether each environment exposes required reviewer and branch restrictions. An API permission failure is **not** proof of protection.

## Remaining before any release

- Confirm actual registry account control (404 from a public endpoint does not establish ownership).
- Finish dependency-lockfile reproducibility and review transitive dependencies.
- Review source distributions, package hashes, secrets scanning, webhook verification and API compatibility.
- Obtain separate, explicit approval for each package publication and version.
- Only after all gates pass, introduce a dedicated publishing workflow referencing the matching protected environment. A GitHub workflow referencing an absent environment can auto-create an **unprotected** one, so do not add publishing jobs first.
- Keep production WhatsApp engine, API, worker, sessions, database and deployment outside SDK release scope.
