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
