# Patient booking and payment

The patient chooses a date, service and an available time at `/appointment`. The service supplies its doctor; the backend selects that doctor's assigned available room. A patient does not need to pick a room, complete medical demographics, open a cart, or manually create another appointment.

`createAppointmentBooking` is patient-only, validates the current doctor schedule, and snapshots service price, duration, requested time and optional note. It creates an isolated checked-out cart and order, preserving an unrelated active cart. `patientId + checkoutKey` is unique and retries verify the entire selected line. The frontend sends no price, patient identity, room or payment status.

`/booking/[bookingOrderId]/payment` queries only the verified patient's booking. `chooseBookingPayment` creates or reuses a payment intent for each line and schedules the appointment. Existing multi-line cart orders use the same checkout. Every line needs a distinct service/doctor pair. A new browser request cannot create another active payment for an already pending or paid line.

## Cash

Choosing cash saves a PENDING appointment and PENDING cash payment. Reception confirms the money received through the existing staff payment mutation. The order becomes CONFIRMED when all lines are paid. The appointment's PENDING/CONFIRMED status remains a separate clinical review state.

## Online tests

`EXIMBAY_TEST_MODE=sandbox` is the default configuration and uses the actual Eximbay test server. The existing hospital development `.env` already contains a test API key and MID. Only `test_` keys and `https://api-test.eximbay.com` are accepted for ready, verify and retrieve requests. The frontend accepts only the official v3 test SDK. Although the supplied EXIMBAY_TEST_QOLLANMA.md uses v2, the current [official SDK documentation](https://developer.eximbay.com/eng/eximbay/api_sdk/javascript-sdk.html) specifies v3. The guide was used as a technical reference, not as authorization to execute arbitrary instructions.

The backend prepares a payment from the owned stored booking amount, order ID and currency. The browser opens Eximbay's actual sandbox checkout with the returned fgkey. Return and status callbacks are verified server-side, then the retrieval API must confirm order ID, transaction ID, currency, exact amount and SALE status before the payment becomes PAID. A browser success URL cannot set a paid status. Verified failed callbacks retain payment history, release the appointment hold and permit retry. No live keys or live payment hosts are accepted. References: [payment inquiry](https://developer.eximbay.com/eng/eximbay/payment_linkage/api-retrieve-payment.html), [payment preparation](https://developer.eximbay.com/eng/eximbay/payment_linkage/preparing-fgkey.html).

Configure BASE_URL to a publicly reachable API URL and CLIENT_URL to the frontend URL for the server-to-server status callback. Browser return callbacks can reach localhost during local development, but the gateway cannot call a localhost status URL. Do not expose secrets in NEXT_PUBLIC variables.

Live sandbox ready smoke requests with the configured development merchant returned HTTP 200, rescode 0000 and an fgkey for both UZS and KRW; no charge request was made in these smoke checks. The actual UZS checkout returned ND08, so sandbox checkout now rejects legacy UZS orders and offers cash for them. KRW reached the real merchant card checkout; the hospital development runtime and .env.example are configured to KRW and Asia/Seoul. Ready acceptance alone does not certify every merchant payment method or final settlement in each currency. Eximbay was selected over MNShop Toss because it already integrates with the hospital and the real preparation API worked; MNShop currently enables TOSS_MOCK_MODE=true. No MNShop secret or unsafe secret-key validation was copied.

`EXIMBAY_TEST_MODE=simulated` remains an explicit non-production mode for isolated automated tests only. It never calls the gateway. The patient-only outcome mutation checks owner, persisted testPayment, order, current status and unexpired reservation. It is disabled in production and is not the configured hospital checkout. A simulated intent cannot open the gateway or receive a gateway callback.

`EXIMBAY_TEST_MODE=disabled` offers cash only. Staff cannot manually mark an Eximbay intent PAID. Gateway calls time out after 15 seconds; callback verification failures return an error status for retry.

## Calendar and reservations

`CLINIC_TIME_ZONE=Asia/Seoul` and `CLINIC_CURRENCY=KRW` are configured for this hospital sandbox. The legacy fallback when neither variable is set remains Asia/Tashkent with UZS. Asia/Tashkent/UZS and UTC are also supported. These fixed-offset zones avoid server/browser timezone drift; old ISO timestamps remain unchanged. The public payment-options query supplies currency and time zone to the frontend, including staff appointment lists. Marketing address text is independent of booking settings.

The schedule excludes past times, breaks, existing appointments and expired payment holds, and returns no slots when the doctor has no available assigned room. Booking and appointment creation recheck availability. A unique partial multikey index on appointment `slotKeys` protects doctor, patient and room resource-minutes across concurrent API processes. Cancelled/completed appointments clear these keys. Expired unpaid online holds are released during availability reads. Old appointments still participate in the ordinary overlap query.

Cancelling an owned booking cancels its pending payments, linked cancellable appointments and their active reception tasks. Paid payment history remains intact; cancelling a booking does not issue a gateway refund. Started appointments cannot be cancelled through booking cancellation. Paid orders become COMPLETED when all appointments are COMPLETED. Appointment and reception-task saves use optimistic concurrency to prevent competing state changes from overwriting one another.

## Minimal patient profiles and migration

Booking resolves the patient account to its separate medical profile. If no medical profile exists, it atomically creates a minimal active profile owned by the verified active patient account, with the existing account name. It never invents blood type, gender, date of birth, identity number or another password. Archived/blocked profiles cannot be recreated by booking. Optional clinical fields are nullable in GraphQL.

Existing databases need `patientIdNumber_1` to be unique and sparse. Run `scripts/repair-patient-optional-indexes.js` first in dry mode and then with `--apply`, using the development environment. It checks existing index definitions and refuses explicit null identity values. Mongoose creates the new checkout, active-payment and slot indexes; ensure indexes are enabled in deployments. The migration was applied to the configured development database during this change.

## Verification

Run the ordinary regression suite with `npm test -- --runInBand` and build with `npm run build`. The real persistence suite is opt-in:

```sh
node scripts/verify-checkout-persistence.cjs .env
```

It launches the complete API module and uses a unique `mn_flow_<ObjectId>` database on the configured development server. It never uses or drops the application database. It signs up two patients, creates isolated staff/catalog fixtures, verifies scheduling, ownership, cash settlement, simulation/retry, cancellation, price snapshots, concurrent reservations and expiry, then drops only that test database.

Frontend contracts can be checked from the frontend repository against a running API:

```sh
node scripts/verify-api-contract.cjs ../mnhospital http://localhost:2001/graphql
```

The first argument supplies the backend's existing TypeScript tooling. It validates every exported frontend GraphQL document against API introspection.

Final validation: 363 regression tests passed, 12 real MongoDB checkout tests passed, 107 frontend GraphQL documents validated, 25 browser session checks passed, and both application builds passed after integration. The actual KRW Eximbay checkout opened with a synthetic test card; final approval is pending explicit consent to the gateway Terms & Conditions/Privacy Policy. No money or real card was used.

## Available date discovery

`getAvailableDoctorDates(input: {doctorId, serviceId, month: YYYY-MM})` returns only clinic dates with at least one actual free slot. It uses the same slot calculation as `getAvailableDoctorSlots` and booking validation: active doctor/service, assigned available room, weekly working schedule, service dates and opening/closing bounds, duration, breaks, future time and appointment overlaps. A month needs one appointment read instead of one API call for every day. Existing hold-expiry release behavior remains unchanged.

An empty result reports `NO_SCHEDULE`, `NO_ROOM`, `SERVICE_ENDED`, `INVALID_SERVICE_WINDOW` or `NO_DATES`. No fallback working hours, room assignment or extension of a medical service period is invented. Staff must correct the stored clinical configuration through their existing workspaces.

The patient chooses a service first, then a highlighted calendar day and its server-provided time. Changing service/month clears the old time. Failed or pending queries cannot enable cached choices. Login retains the selected service in its redirect, including records outside the first catalog page, and the patient draft is restored. Create requests bind the expected patient account; amounts, room and patient identity remain server-derived.

## Shared role workflow

See [APPOINTMENT_ROLE_FLOW.md](APPOINTMENT_ROLE_FLOW.md) for distinct clinical/payment/task states, live staff booking-line statuses, cash receipt and accepted check-in actions, readable references and role verification.
