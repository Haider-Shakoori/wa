# SDK release-readiness checks (no publishing)

Run **SDK release readiness (no publishing)** manually on `main` or through a pull request affecting SDKs.

The workflow:
- Runs Python, PHP, and .NET offline contract tests and TypeScript offline tests.
- Copies the TypeScript SDK to an isolated temporary directory, without modifying the monorepo root lockfile.
- Uses the reviewed, committed `packages/sdk-typescript/package-lock.json` for `npm ci` twice and compares hashes of generated JavaScript and declarations.
- Verifies the npm archive contains its entrypoints, README, and MIT license; verifies other SDK MIT license files exist.
- Asserts the npm SDK still has `private: true` and uploads a short-lived artifact with a SHA256 manifest and generated TypeScript lockfile.

**Locked dependency installation:** The TypeScript SDK has a committed npm lockfile, generated in the successful non-publishing readiness run and verified against the uploaded SHA256 manifest. CI uses `npm ci` in isolated SDK workspaces. Review and update the SDK-local lockfile deliberately when upgrading dependencies; do not regenerate or commit the monorepo root pnpm lockfile as part of this process.

The workflow does not publish SDKs, configure registry credentials, deploy production services, or require a release environment. Protected environments and registry ownership must be reviewed separately before any publishing workflow is authorized.
