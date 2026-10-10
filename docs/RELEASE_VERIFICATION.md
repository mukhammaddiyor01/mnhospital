# MN Hospital release verification — 2026-10-10

Status: local four-role clinical workflows verified after a runtime input-validation fix. This is not a verification of a deployed production environment or a live card merchant.

## What was tested

The snapshot includes the original frontend/backend working trees, including existing uncommitted changes. Synthetic accounts and disposable Mongo databases were used; real clinic records and real charges were not used.

| Role / flow | Evidence |
| --- | --- |
| Admin | Browser login, doctor list, service discount editor (150,000 → 135,000 KRW), fixed 7,000 KRW promo creation and homepage publication. API tests cover role-scoped CRUD, packages and pricing validation. |
| Patient | Browser login, real available date/time, booking checkout, cash booking, own report, direct message. API checks cover cancellation, pricing/promo snapshots, online simulation, ownership, likes/follows and unique views. |
| Receptionist | Browser sees unassigned intake, accepts CHECK_IN, sees doctor confirmation, checks in patient, reads assigned report and PAID cash receipt. The cash confirmation mutation was verified through the isolated API; its native browser confirmation interrupted the automation tab before recovery. |
| Doctor | Browser sees the same appointment, confirms, sees reception check-in, creates a report from its appointment link, sees COMPLETED after API completion, and reopens the existing report editor. API checks verify ownership, completion and report distribution. |
| Messages / notifications | Four-way API message send/read/unread/ownership checks; browser patient → doctor message shows unread badge and clears it after opening the conversation. |
| Sessions | All four roles signed in in separate browser tabs. Rotation, replay, logout, password/session invalidation, CSRF and cross-role privacy have dedicated API tests. |

## Fixes

Production previously installed `new ValidationPipe()` while checkout verification enabled transformation. A report appointment ID was validated as an ObjectId but still reached Mongo aggregation as a string. Production now uses the shared `createInputValidationPipe()` with `transform: true`, also used by checkout persistence verification. Regression tests check ObjectId delivery, invalid-ID rejection and GraphQL upload bypass.

The frontend profile-presentation verification script was missing stubs for two existing components. Its test harness now loads them correctly; no product behavior was changed for this fix.

## Final results

- Backend regression: 56 passing suites, 428 passing tests. The two opt-in Mongo suites were checked separately.
- Mongo checkout / clinical / social / promotion persistence: 41/41 passed in the final full confirmation run.
- Mongo follow/index persistence: 1/1 passed.
- Auth and private-access persistence: 248 checks passed.
- Additional isolated four-role clinical/message API workflow: 66 checks passed.
- Frontend auth: 42 checks; profile presentation: 39; dark contrast: 70; booking calendar: 16; options: 37 + 17; promotions: 30; service calendar: 8; homepage: 28; Eximbay test-card: 30; visible workspace refresh: 18. Signup, follow refresh and Eximbay checkout scripts also passed.
- 427 GraphQL documents / 174 API fields: zero contract errors.
- 58 static production-build routes: HTTP 200. Route health is separate from authenticated behavior verification.
- Backend and Next.js production builds passed.
- Console error inspection of the final patient, doctor, receptionist and admin tabs returned no errors.

One earlier full Mongo run returned an incomplete response in the slot/expired-hold test. The focused case passed, followed by a complete 41/41 pass. The transient response was not reproduced or attributed to a code change.

## Deployment limits

1. Eximbay is explicitly restricted to `api-test.eximbay.com` and `test_` credentials. Local simulated results are blocked in production. Do not treat this as live card-payment readiness; use cash or a clearly identified sandbox/demo until a real merchant integration is implemented and tested.
2. Production HTTPS, API/frontend URLs, allowed session origins, cookie SameSite setting (for different sites), persistent uploads, WebSocket routing and production Mongo connection must be configured on the deployment host. Local presence of environment variables does not verify the deployment host.
3. Social OAuth callbacks and a live AI-provider response were not exercised in this audit. AI tests validate configuration and error handling without paid external calls.
4. Deploy this verified working-tree snapshot. For Git-based deployment, the existing modified/untracked product files must be committed and pushed; testing the local tree does not verify the remote branch.

Browser evidence is saved under the workspace `release-verification/proof/` directory: patient-report.png and reception-payment.png.
