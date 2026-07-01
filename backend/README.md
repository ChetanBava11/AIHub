# Backend Phase 2

This folder contains the backend for a multi-tenant AI Business Operations Platform. The current phase includes the foundation from Phase 1 plus the CRM modules, unified inbox, and dashboard KPI aggregation that complete Phase 2.

## Architecture

The backend is an Express + TypeScript app built around a simple route → controller → service → database flow.

- PostgreSQL and Prisma store the core CRM data: tenants, users, contacts, opportunities, tasks, refresh tokens, and audit logs.
- MongoDB and Mongoose store inbox messages because message threads are document-shaped and can grow independently of the relational CRM models.
- `requireAuth` is the tenant boundary. It verifies the access token cookie and attaches `{ userId, tenantId }` to `req.auth`.
- Every tenant-aware query must use `req.auth.tenantId`. Controllers and services never trust tenant data from the request body, query string, or headers.

## Local Setup

1. Copy `.env.example` to `.env` and fill in the required values.
2. Start PostgreSQL and MongoDB from the repo root:

```bash
docker compose up -d
```

3. Install backend dependencies:

```bash
npm install
```

4. Generate Prisma Client and apply the database schema:

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
```

5. Start the API in watch mode:

```bash
npm run dev
```

The health check is available at `GET /health`.

## Required Environment Variables

The backend expects these values in `.env`:

- `DATABASE_URL`
- `MONGO_URL`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `FRONTEND_URL`
- `COOKIE_SECRET`

`NODE_ENV` and `PORT` are optional.

## OAuth + PKCE Flow

1. The frontend calls `GET /auth/google/init`.
2. The backend generates a high-entropy `code_verifier`, derives a SHA-256 `code_challenge`, and stores the verifier in a short-lived signed cookie.
3. The backend also stores a signed `state` cookie so the callback stays bound to the same browser session.
4. The backend returns the Google consent URL containing the `code_challenge`.
5. The browser is redirected to Google.
6. Google redirects back to `GET /auth/google/callback` with `code` and `state`.
7. The backend validates the state, reads the verifier cookie, and exchanges the code for Google tokens.
8. The backend fetches the Google profile, finds or creates the local tenant and user, then issues the app session cookies.
9. The backend redirects to `FRONTEND_URL` with `auth=success` and `onboarding_required=true|false`.

The redirect flag is only a convenience. The frontend can always call `GET /me` after login to confirm the final session state.

## Refresh Rotation

1. Login issues a 15 minute JWT access token and a 7 day opaque refresh token.
2. Only the hash of the refresh token is stored in PostgreSQL.
3. `POST /auth/refresh` hashes the incoming token and looks it up in the database.
4. Missing, expired, or invalid tokens are rejected with `401`.
5. If an already-used refresh token is replayed, the backend revokes all refresh tokens for that user and forces a clean login.
6. Valid unused refresh tokens are rotated atomically.

This keeps refresh tokens single-use and makes replay detectable.

## Phase 2 Modules

- Contacts: tenant-scoped CRM contact records.
- Opportunities: tenant-scoped pipeline records with stage and value tracking.
- Tasks: tenant-scoped follow-up tasks.
- Unified inbox: Mongo-backed message threads grouped by contact, with full per-contact timelines and demo seeding for local development.
- Dashboard: KPI aggregation for active opportunities, revenue pipeline, pending follow-ups, customer activity, and an `aiAlertsCount` placeholder currently set to `0`.

## API Overview

- `GET /health`
- `GET /auth/google/init`
- `GET /auth/google/callback`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `PUT /tenant/onboarding`
- `GET /contacts`
- `POST /contacts`
- `GET /contacts/:id`
- `PUT /contacts/:id`
- `DELETE /contacts/:id`
- `GET /opportunities`
- `POST /opportunities`
- `GET /opportunities/:id`
- `PUT /opportunities/:id`
- `DELETE /opportunities/:id`
- `GET /tasks`
- `POST /tasks`
- `GET /tasks/:id`
- `PUT /tasks/:id`
- `DELETE /tasks/:id`
- `GET /inbox`
- `GET /inbox/:contactId`
- `POST /inbox/seed-demo-data`
- `GET /dashboard/kpis`

## AI Tools

The backend now includes tenant-scoped AI tool modules for Sprint 9A and Sprint 9B.

- `searchContacts` searches up to 10 tenant contacts by name, phone, email, or company.
- `createTask` creates a tenant task for a validated contact and due date.
- `updateOpportunity` updates an opportunity stage, optional value, and stores `aiNextBestAction`.
- `fetchBusinessMetrics` reuses `DashboardService.getKpis()` and returns tenant-scoped KPI numbers.
- `sendWhatsApp` is intentionally mocked for Sprint 9B and only simulates message delivery.

All tools use `scopedPrisma(tenantId)` or tenant-scoped services to enforce tenant isolation and write audit entries via `logAudit`.

Tool audit details:

- `AI_TOOL_SEARCH_CONTACTS` logs `{ query, resultCount }`
- `AI_TOOL_CREATE_TASK` logs `{ contactId, taskId, dueDate }`
- `AI_TOOL_UPDATE_OPPORTUNITY` logs `{ opportunityId, previousStage, newStage, updatedValue }`
- `AI_TOOL_FETCH_BUSINESS_METRICS` logs `{ requestedBy: userId }`
- `AI_TOOL_SEND_WHATSAPP` logs `{ contactId, messageLength, mockMode: true }`

`sendWhatsApp` uses a placeholder service in `src/services/whatsapp.ts`.
It logs a mock delivery message and returns `{ success: true, mock: true, timestamp: new Date() }`.
This file is the only place that must change when replacing the mock with a real Meta Cloud API implementation.

## Testing

The Jest + Supertest suite covers:

- `requireAuth` rejecting missing, invalid, and expired access tokens
- refresh token rotation and reuse detection
- contacts, opportunities, and tasks CRUD
- unified inbox listing, thread retrieval, demo seeding, and tenant isolation
- dashboard KPI aggregation and tenant isolation

For local verification, run:

```bash
npm test
npm run build
```
