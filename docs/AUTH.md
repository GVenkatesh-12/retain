# Authentication

Retain uses OpenAuth with its built-in `PasswordProvider`. The only configured provider is email and password; no Google, GitHub, or other social providers are enabled.

The web app uses the OpenAuth PKCE authorization-code flow. Access and refresh tokens are kept in session storage for the SPA, and the API verifies bearer tokens against the same OpenAuth issuer before resolving the authenticated `user_id`.

## Local development

Run the auth server and web app with:

```sh
VITE_OPENAUTH_ISSUER=http://127.0.0.1:3001 npm run dev:full
```

The OpenAuth server stores development credentials in `.retain-auth.json`, which is ignored by Git. Registration and password reset require an email verification code. Local development logs that code in the auth server terminal; production must replace `sendCode` with a transactional email provider.

The API accepts unauthenticated requests only when `OPENAUTH_ISSUER` is unset, which is intended for local API smoke tests. Production must set `OPENAUTH_ISSUER` and never use the installation-user fallback.
