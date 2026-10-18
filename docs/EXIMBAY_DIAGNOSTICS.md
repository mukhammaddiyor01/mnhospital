# Eximbay checkout diagnostics — 2026-10-18

The public deployed payment-options query reports SANDBOX / KRW / Asia/Seoul. The official sandbox SDK URL responds successfully.

A payment-preparation request using synthetic buyer/order details and the configured backend merchant returned HTTP 200 with `{code: "EC1000", message: "Authorization is invalid"}` and no fgkey. No real card charge was requested. The response uses `code/message`, while the existing integration read only `rescode/resmsg` and displayed the misleading error `Eximbay ready failed: OK`.

The gateway transport now handles these error envelopes, connection failures and invalid JSON. It logs only the operation and safe provider code, and returns a recoverable patient message without provider/private response details. The patient checkout also waits for the SDK before creating an online intent and no longer silently skips opening the gateway when the SDK is not ready. Callback verification, stored prices, ownership and sandbox restrictions remain in force.

To restore the actual gateway connection, the operator must check the active sandbox API key and matching MID in the Eximbay merchant dashboard, update backend `EXIMBAY_API_KEY` / `EXIMBAY_MID`, and restart the backend (or recreate the backend container with those environment values). Do not expose these credentials in client environment variables, chat, source control or logs. An fgkey is generated for an individual checkout; it is distinct from the merchant API credential.

Verification: 13 Eximbay unit checks, full backend suite (430 passing tests; optional Mongo suites skipped), backend API build, frontend SDK regression and Next.js production build. Live readiness and a completed sandbox payment cannot be claimed while the configured merchant is rejected with EC1000.

References: https://developer.eximbay.com/eng/eximbay/payment_linkage/preparing-fgkey.html and https://developer.eximbay.com/eng/eximbay/api_list/reference.html.
