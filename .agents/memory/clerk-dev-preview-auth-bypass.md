---
name: Clerk dev-preview auth bypass
description: Why authenticated API routes 401 in the embedded dev preview and how to mirror the frontend bypass safely.
---

In the embedded dev preview (app runs inside an iframe), Clerk session cookies are
blocked as third-party, so `getAuth(req)` sees no session and every authenticated
API route returns 401 in dev — even though the frontend already bypasses login via
`PREVIEW_MODE = import.meta.env.DEV`.

**Rule:** when an authenticated `api-server` route must work in dev preview, gate the
auth check behind `process.env.NODE_ENV === "development"` (NOT `!== "production"`),
e.g. `if (!auth?.userId && !isDev) return 401;`. This mirrors the frontend and never
relaxes auth in production or staging-like environments.

**Why:** `!== "production"` would also relax auth in any non-prod-like env; `=== "development"`
is the explicit dev signal (the api-server dev workflow runs with `NODE_ENV=development`).

**How to apply:** the cifra route uses this. The transcribe route has the same 401-in-preview
symptom — apply the same gate there if/when it needs to work in dev preview.
