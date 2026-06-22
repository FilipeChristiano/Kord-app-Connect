---
name: api-server dev runs without file watch
description: Why adding/editing an api-server route needs a manual workflow restart
---

The `api-server` dev workflow runs the server with plain `tsx ./src/index.ts` (no `--watch`).

**Symptom:** a newly added/edited Express route returns 404 (or the client shows a
generic "couldn't reach the server" / network error) even though the route exists in
code and typecheck passes. The running process was started before the route existed
and never reloaded.

**Why:** no watch mode → the Node/tsx process keeps the old module graph until killed.

**How to apply:** after any change under `artifacts/api-server/src/**`, restart the
`artifacts/api-server: API Server` workflow before testing. Confirm a protected route
is loaded by curling it unauthenticated and expecting 401 (not 404), e.g.
`curl -s -o /dev/null -w "%{http_code}" -X POST localhost:8080/api/<route>`.
Routes mount under `/api` (`app.use("/api", router)` in `app.ts`).
