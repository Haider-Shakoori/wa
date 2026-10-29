# npm SDK stage eligibility — no registry action

This change makes `@relaywa/sdk` version `0.1.0` eligible for a future **explicitly approved** npm staged publication by setting `private: false` and `publishConfig.access: public`.

**Important:** `private: false` removes npm's package-level publishing block. The remaining safety boundary is that no enabled workflow has an npm publish/stage command or credentials. Do not add registry credentials, invoke npm stage/publish, or configure automation without separate approval.

After merging:
1. Manually run `npm SDK staged-release preflight (no staging)` on main with `PREFLIGHT_ONLY`.
2. Review successful tests and npm pack dry-run contents.
3. Confirm package name, account ownership, and npm staging requirements.
4. Request explicit authorization before any first-stage action, which may create a public `0.0.0-stage` placeholder.
5. Staged approval/public release requires another explicit authorization.

No WhatsApp production engine, API, workers, sessions, queues, databases, deployments, or root pnpm lockfile modifications.
