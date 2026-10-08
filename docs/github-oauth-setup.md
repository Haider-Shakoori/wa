# GitHub OAuth login — production activation

RelayWA's tenant GitHub signup/login implementation is already in the repository (PR #47). **Do not create another login implementation or expose the GitHub Client Secret in source control, Next.js environment variables, or Platform Admin.** Platform administrators continue using the separate private platform login.

## 1. Register the GitHub OAuth App

1. Sign in to the GitHub account that should own the OAuth App.
2. Open [GitHub Developer settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App** (or **Register a new application**).
3. Enter:
   - **Application name:** `RelayWA`
   - **Homepage URL:** `https://relaywa.com`
   - **Application description:** `Secure account sign-in for the RelayWA messaging platform.` (optional)
   - **Authorization callback URL:** `https://relaywa.com/api/auth/github/callback`
   - **Device flow:** leave disabled; RelayWA uses the web authorization-code flow.
   - **Callback wildcard matching:** disabled, if the setting is shown. The application only needs the exact canonical callback.
4. Register the application.
5. Copy the **Client ID**, generate one **Client Secret**, and save the secret in the production secret manager or API runtime environment. Never put either credential in a public issue, screenshot or chat; treat the Client Secret as a password.

> Register an **OAuth App**, not a GitHub App. The current RelayWA implementation exchanges GitHub OAuth authorization codes and requests `read:user user:email` to confirm a verified email address.

## 2. Configure the deployed API

Ensure the server currently serves GitHub signup/login code (PR #47 and later). Set these **in the actual environment loaded by the API process**:

```dotenv
GITHUB_CLIENT_ID=<the-client-id-from-github>
GITHUB_CLIENT_SECRET=<the-client-secret-from-github>
GITHUB_CALLBACK_URL=https://relaywa.com/api/auth/github/callback
AUTH_FRONTEND_URL=https://relaywa.com
```

The `<...>` values above are placeholders, not values to check in or publish. Depending on how production is deployed, the API may use a systemd environment file, PM2 environment settings, Docker secrets/Compose environment, or another secret manager. Updating a checkout's `.env` alone has no effect unless the running API process actually loads it. Reload/restart **only the API service** so it receives updated environment values; the web UI also requires the already-merged frontend release but does not need the secret.

Confirm the reverse proxy sends `https://relaywa.com/api/auth/github/callback` to RelayWA's API, not the Next.js web application. The user-facing app continues on `https://relaywa.com`.

## 3. Run the required schema migration

The GitHub login callback stores a short-lived, one-time login exchange code in `oauth_login_codes`. Migration `apps/api/migrations/028_oauth_login_codes.sql` must be applied before enabling live GitHub login.

From the correct checkout, with the production database environment explicitly loaded:

```bash
pnpm --filter @wa/api migrate
```

The repository migrator uses `relaywa_schema_migrations`; confirm migration 028 is recorded and that the database connection is healthy. Do **not** reset production data or reinitialize existing tenants.

## 4. Enable provider through Platform Admin

1. Log in through RelayWA's private Platform Admin login.
2. Go to **Authentication** → **Tenant login providers** → **GitHub**.
3. Paste only the **GitHub OAuth App Client ID** into the form.
4. Confirm the platform reports that the server-side Client Secret is configured.
5. Switch **GitHub** to enabled and select **Save GitHub settings**.

The platform prevents enabling GitHub sign-in if the server-side Client Secret is missing. The GitHub login button appears on tenant registration/login pages, not on the Platform Admin login.

## 5. Verify the full browser flow

1. Confirm the live API endpoint `GET https://relaywa.com/api/auth/providers` reports `github.enabled: true` after activation (the actual request path depends on reverse-proxy forwarding of `/api`).
2. Open `https://relaywa.com/login` in a private browser session and select **Continue with GitHub**.
3. Verify GitHub shows `RelayWA` with expected profile/email read permissions; authorize the app using a GitHub account with at least one **verified email**.
4. Confirm the browser returns to `https://relaywa.com/login` or `/register` and finishes the one-time code exchange; login should open the intended tenant dashboard/plan/onboarding destination, **not** the private Platform Admin.
5. Confirm a returning account links only when an existing RelayWA user's email matches a **verified** GitHub email. Do not reuse or expose one-time exchange codes.
6. Confirm normal email/password and Google sign-in continue working. Verify the Platform Admin login remains private, without GitHub or Google social buttons.
7. Check API and reverse-proxy logs for errors; avoid recording OAuth authorization codes, access tokens, exchange codes, Client Secrets or authenticated cookies.

If **Continue with GitHub · Setup required** is displayed, either the provider is disabled or the Client ID/Client Secret is not configured. If GitHub reports **redirect_uri_mismatch**, check the exact canonical callback and proxy routing. If the callback fails after granting access, check migration 028, server environment, and API logs.

## Rollback

Disable **GitHub** in Platform Admin (or remove the API's GitHub secret and restart that API process), without dropping tables, deleting identities, or changing existing password/Google authentication. If a Client Secret was exposed, immediately revoke/rotate it in GitHub Developer settings and update the server-side secret.

## Reference

- [RelayWA social-auth implementation](https://github.com/Haider-Shakoori/wa/pull/47)
- [Official GitHub OAuth App registration guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [OAuth authorization flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
