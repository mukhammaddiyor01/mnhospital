# Hospital authentication sessions

Patient accounts authenticate from `Member`; doctor, receptionist and admin accounts authenticate from their own collections. A medical `Patient` profile remains linked by `memberId` and is not a login account. Public signup still creates only patient accounts; staff use the existing admin APIs.

The existing login, signup and social-auth mutations return `accessToken` and set separate host-only role refresh cookies in the browser; legacy API clients without a role selector retain `mn-hospital-refresh`. The cookie is HttpOnly, has path `/graphql`, and expires with its session after 30 days. The access JWT lasts 15 minutes and contains the verified role/profile ID, session ID and display fields; passwords, contact details and clinical content are not JWT claims.

Each `refreshToken` document owns a role/profile pair and stores only hashes. `refreshSession` consumes the current hash through an atomic compare-and-update, saves the consumed hash and sets a new cookie. Replaying any consumed credential revokes that login session, including its current access token. Concurrent consumers fail closed. Expiry is checked in queries independently of Mongo TTL cleanup. Rotation does not extend the original 30-day deadline.

```graphql
mutation RefreshSession { refreshSession { accessToken } }
mutation LogoutSession { logoutSession }
```

Call with credentials included and `Apollo-Require-Preflight: true`. Session mutations reject untrusted Origin headers; allowed origins come from `AUTH_ALLOWED_ORIGINS` (comma-separated), then the existing `CLIENT_URL`, then local defaults `http://localhost:2002,http://localhost:3000`. A server client without Origin must still send the preflight header. Refresh credentials are never accepted as GraphQL input or returned in a result.

Production cookies are Secure and SameSite=Lax. When frontend and API use different sites, configure HTTPS, `AUTH_COOKIE_SAMESITE=none`, the exact allowed frontend origins and credentialed frontend transport. `SECRET_TOKEN` is required at application startup.

Docker Compose reads `CLIENT_URL` and `AUTH_ALLOWED_ORIGINS` from the backend `.env` instead of overriding them with localhost values. On the server, set both to the actual frontend origin, including its scheme and public port (for example, `http://76.13.242.85:2002` for the current IP deployment). Origins are frontend URLs, not the API URL or the container's internal port. If `AUTH_ALLOWED_ORIGINS` is absent, Compose keeps the local origins and adds `CLIENT_URL`. After changing these values, recreate the API container with `docker compose up -d --no-deps --force-recreate mnhospital-api`; a plain restart does not update its environment. Production refresh cookies still require HTTPS.

`logoutSession` revokes the cookie session and any supplied signed bearer session, even if the access JWT expired, then clears the cookie. It is idempotent and leaves other login sessions active. A persistence failure is returned without claiming logout succeeded.

Both authenticated guards verify JWT expiry, role/profile/session ownership, session expiry/revocation and current active profile on every request. BLOCK/DELETE and password changes increment `sessionVersion` atomically with the profile change; old sessions cannot return after reactivation. Administrative account edits cannot create staff roles. Doctor/receptionist creation does not issue a staff login token to the admin. The patient getMyMemberProfile API restores owned contact data after reload; private Member contact fields are visible only to their patient owner or admin, including in nested public results. Contact-profile edits renew display claims in the existing session. The shared changeMyAccountPassword mutation checks the current password for all four roles, hashes the replacement, atomically increments the owned profile session version, revokes previous sessions and gives the authenticated browser a replacement session. updateMyAccountProfile accepts only personal fields supported by the verified role and renews display claims without revoking the session.

Existing admin documents without a status field retain their original active behavior; deleted admin records are rejected. Patient medical-profile status and patient account status remain separate operations. Optional public authentication falls back to anonymous access when the supplied token is invalid.

The frontend serializes same-role refresh/login/logout across tabs with Web Locks where available, shares simultaneous refresh requests, refreshes before expiry, retries a guard rejection once and does not retry ambiguous business-write network failures. Logout waits for pending refresh. Refresh secrets stay in the cookie. Owned Apollo/React Query caches clear on identity change/logout; late results from a previous identity are rejected. WebSocket clients renew credentials when reconnecting.

Old access JWTs without a session ID are intentionally rejected after rollout. Existing users must sign in once again.

## Verification

- `npm test -- --runInBand --watchman=false`: role policies, rotation/replay, account boundaries, ownership, WebSocket revocation and GraphQL/cookie/CSRF tests.
- Frontend: `npm run test:auth` verifies concurrency, logout, aliases, failure handling, guarded retry and stale-response rejection.
- `node scripts/verify-auth-access.cjs`: uses `.env` (or `MN_AUTH_VERIFY_ENV_FILE`) and a newly named Mongo database; authenticates all four roles, exercises rotation/replay/logout, password replacement across devices, CSRF, role collisions, preferences, private messages, notifications, report/payment/order ownership and block/reactivation. Cleanup drops only the generated test database. It never uses application documents or calls an AI/payment provider.

## Parallel browser roles

Read [ROLE_SESSIONS.md](ROLE_SESSIONS.md). The browser now keeps access JWTs in per-tab sessionStorage and selects separate HttpOnly refresh cookies for PATIENT, DOCTOR, RECEPTIONIST and ADMIN with X-MN-Session-Role. All four can stay logged in together in separate tabs; one active account per role per browser profile. Same-role replacement invalidates earlier tabs; other roles stay active. Scoped refresh binds the signed (possibly expired) access JWT to the cookie session before rotation. Stale-tab logout cannot clear or revoke a replacement account. Legacy API clients without the header retain the legacy cookie. Existing global localStorage credentials are intentionally not auto-restored; sign in again once after rollout.

Verified: 42 frontend auth checks, 161 backend auth regression tests, 248 checks against the actual API with isolated Mongo persistence, both application builds, and four concurrent role tabs in the browser including reload and patient-only logout.
