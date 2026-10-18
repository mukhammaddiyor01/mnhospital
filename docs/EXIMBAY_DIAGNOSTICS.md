# Eximbay checkout diagnostics — 2026-10-18

The public deployed payment-options query reports SANDBOX / KRW / Asia/Seoul. The official sandbox SDK URL responds successfully.

A payment-preparation request using synthetic buyer/order details and the configured backend merchant returned HTTP 200 with `{code: "EC1000", message: "Authorization is invalid"}` and no fgkey. No real card charge was requested. The response uses `code/message`, while the existing integration read only `rescode/resmsg` and displayed the misleading error `Eximbay ready failed: OK`.

The gateway transport now handles these error envelopes, connection failures and invalid JSON. It logs only the operation and safe provider code, and returns a recoverable patient message without provider/private response details. The patient checkout also waits for the SDK before creating an online intent and no longer silently skips opening the gateway when the SDK is not ready. Callback verification, stored prices, ownership and sandbox restrictions remain in force.

## Credential provenance and repeated check

The configured API key matches the public test example in Eximbay's official payment-preparation documentation. It is a shared example credential, not evidence of a merchant account created for MN Hospital, and the MID is not a dashboard login. Do not try to recover a dashboard password from these environment values.

A fresh comparison against the official documentation and two sandbox `/ready` requests (KRW 7,000 and USD 1, with synthetic order/buyer data) both returned HTTP 200 / `EC1000` / `Authorization is invalid`, with no fgkey. This confirms that changing the clinic currency does not resolve the observed authorization failure. No card information was submitted and no charge was requested. The cause of the provider's rejection of its published example cannot be determined from this response alone; do not label the key expired or revoked without provider confirmation.

Eximbay documents the shared key as usable before a merchant contract, so an existing dashboard account should not be assumed. If no account has been issued, ask Eximbay integration support to confirm a working sandbox key/MID or restore the published test example. If a merchant has already been onboarded, check the issued credentials in its onboarding email or with its account contact. The application cannot create or infer these credentials. Dashboard access is only relevant if an account already exists.

Reference: https://developer.eximbay.com/eng/eximbay/payment_linkage/preparing-payment.html.

Once Eximbay supplies or confirms working sandbox credentials, update backend `EXIMBAY_API_KEY` / `EXIMBAY_MID` if needed and restart the backend (or recreate the backend container with those environment values). For an existing merchant, the dashboard or onboarding contact may provide the issued credentials; dashboard login is not a prerequisite for using a working published test example. Do not expose these credentials in client environment variables, chat, source control or logs. An fgkey is generated for an individual checkout; it is distinct from the merchant API credential.

Verification: 13 Eximbay unit checks, full backend suite (430 passing tests; optional Mongo suites skipped), backend API build, frontend SDK regression and Next.js production build. Live readiness and a completed sandbox payment cannot be claimed while the configured merchant is rejected with EC1000.

References: https://developer.eximbay.com/eng/eximbay/payment_linkage/preparing-fgkey.html and https://developer.eximbay.com/eng/eximbay/api_list/reference.html.
