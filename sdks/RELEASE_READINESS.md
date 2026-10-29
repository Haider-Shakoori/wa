# SDK release-readiness checks (no publishing)

Run **SDK release readiness (no publishing)** manually on `main` or through a pull request affecting SDKs.

The workflow:
- Runs Python, PHP, and .NET offline contract tests and TypeScript offline tests.
- Copies the TypeScript SDK to an isolated temporary directory, without modifying the monorepo root lockfile.
- Resolves exact pinned compiler dependencies into a temporary npm lockfile, runs `npm ci` twice, and compares hashes of generated JavaScript and declarations.
- Verifies the npm archive contains its entrypoints, README, and MIT license; verifies other SDK MIT license files exist.
- Asserts the npm SDK still has `private: true` and uploads a short-lived artifact with a SHA256 manifest and generated TypeScript lockfile.

**Important limitation:** This workflow demonstrates repeatable installation and outputs *within one run*. Because the TypeScript SDK does not yet commit its own package-lock.json, dependency resolution may differ across future runs. Before public release, review the generated lockfile and commit a vetted SDK-local lockfile, then switch the isolated build to `npm ci` without generating a lockfile. Do not regenerate or commit the monorepo root pnpm lockfile as part of this process.

The workflow does not publish SDKs, configure registry credentials, deploy production services, or require a release environment. Protected environments and registry ownership must be reviewed separately before any publishing workflow is authorized.
