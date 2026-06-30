# Backend Phase 1 Foundation

This folder contains Phase 1 of the backend for a multi-tenant AI Business Operations Platform. In this phase we only build the foundation: Express + TypeScript setup, PostgreSQL schema, MongoDB connection scaffold, Google OAuth with PKCE, JWT auth, refresh token rotation, tenant onboarding, and the initial automated tests.

## Run locally

1. Copy `.env.example` to `.env` and fill in the secrets plus Google OAuth values.
2. Start local databases from the repo root:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client and run the first migration:

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
```

5. Start the API:

```bash
npm run dev
```

The API exposes `GET /health` for a quick liveness check.

## OAuth + PKCE flow

1. The frontend calls `GET /auth/google/init`.
2. The backend generates a high-entropy `code_verifier`, derives a SHA-256 `code_challenge`, and stores the verifier in a short-lived signed cookie.
3. The backend also stores a signed `state` cookie to bind the callback to the same browser session.
4. The backend returns the Google consent URL containing the `code_challenge`.
5. The browser is redirected to Google.
6. Google redirects back to `GET /auth/google/callback` with `code` and `state`.
7. The backend reads the signed verifier cookie, validates `state`, and exchanges the code for Google tokens.
8. The backend fetches the Google profile, finds or creates the local `Tenant` and `User`, then issues the app session cookies.
9. The backend redirects to `FRONTEND_URL` with `auth=success` plus `onboarding_required=true|false`.

The redirect query parameter is only a convenience flag. The frontend can always call `GET /me` after redirect to confirm the final login and onboarding state.

## Refresh rotation + reuse detection

1. Login issues a 15 minute JWT access token and a 7 day opaque refresh token.
2. Only the hash of the refresh token is stored in PostgreSQL. The raw token never leaves the cookie.
3. When `POST /auth/refresh` is called, the backend hashes the incoming refresh token and looks it up in the database.
4. If the token is missing, expired, or otherwise invalid, the request is rejected with `401`.
5. If the token exists and is already marked `used`, the backend treats that as refresh token reuse. This is a strong signal that the token may have been copied or stolen.
6. On reuse detection, the backend revokes all refresh tokens for that user and returns `401`, forcing a clean login.
7. If the token is valid and unused, the backend atomically marks it as used, creates a brand-new refresh token, and sends both fresh cookies back to the browser.

This design means a refresh token is single-use. Replay of an old refresh token becomes detectable instead of silently creating parallel sessions.

## Tenant isolation pattern

`requireAuth` is the boundary that establishes tenant context. It reads the signed access token cookie, verifies the JWT, and attaches `{ userId, tenantId }` to `req.auth`.

Future controllers must never trust `tenantId` from request body params, query params, headers, or frontend state. Every tenant-aware query should use `req.auth.tenantId` only. That keeps cross-tenant data access from being possible through request tampering.

## API overview

- `GET /health`
- `GET /auth/google/init`
- `GET /auth/google/callback`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `PUT /tenant/onboarding`

## Testing

The included Jest + Supertest suite covers:

- `requireAuth` rejecting missing and invalid or expired access tokens
- refresh token rotation
- refresh token reuse detection revoking the session

Use `.env.test.example` as the starting point for a dedicated test configuration if you later add database-backed integration tests.
