# Security hardening, 2026-11-04

## Changes

- GraphQL CORS and WebSocket browser upgrades use the same exact `AUTH_ALLOWED_ORIGINS` allowlist. Unknown, `null`, and absent browser origins receive no CORS grant. Native requests without `Origin` still reach the API; authentication and role checks remain in force.
- Docker binds API and batch ports to loopback. The separate Next.js compose file also binds port 2002 to loopback. Nginx remains the public HTTPS entry point.
- Production GraphQL Playground and introspection are disabled explicitly. Multipart upload parsing now matches the existing 5 MiB per-image validation limit.
- Production API responses send HSTS; the frontend sends HSTS and a narrow CSP protecting object embedding, base URLs, and framing. HSTS does not protect traffic sent directly to an HTTP IP address; loopback-only ports close that route from the public network.
- Non-breaking lockfile security patches update `proxy-addr`, `follow-redirects`, `moment`, and `qs`.

## Deployment checks

Set `CLIENT_URL=https://mnhospital.uz` and `AUTH_ALLOWED_ORIGINS=https://mnhospital.uz,https://www.mnhospital.uz` in the backend `.env` before recreating the API. Recreate the frontend container too so its port binding and Next.js patch take effect. Verify Nginx proxies `/graphql` to `127.0.0.1:2001` and other routes to `127.0.0.1:2002` before deployment. Confirm `docker compose ps` and `ss -ltnp` show the three container ports on `127.0.0.1`, not `0.0.0.0`.

After deployment, an OPTIONS request with `Origin: https://attacker.invalid` must not return `Access-Control-Allow-Origin`; the same request from `https://mnhospital.uz` must return that exact origin. HTTPS responses should include `Strict-Transport-Security`. Recheck login, refresh, logout, chat, and booking from the website.

## Remaining work

The backend production dependency audit still reports 27 advisories after safe patch updates (15 high, 12 moderate). Most require a coordinated Nest/Apollo/GraphQL major-version migration; `npm audit fix --force` was not applied because that would change the framework beneath live booking and payment flows. Add reverse-proxy request-rate controls and monitoring for login, GraphQL, and WebSocket traffic on the server. This change does not claim protection against every attack or replace a penetration test.
