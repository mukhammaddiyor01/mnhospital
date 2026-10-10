# Appointment and reception workflow

Service selection → server-discovered clinic date and slot → owned booking → payment choice → saved appointment. Clinical appointment status, payment status, booking settlement and reception task status are separate domains.

## Reported Dr Mark case

A read-only inspection found the current Dr Mark appointment CONFIRMED, its cash payment PENDING and its booking order PENDING. There was no reception task. The earlier Eximbay attempt was FAILED. Doctor confirmation was saved correctly; booking PENDING meant payment had not been received. No clinical records or payment receipts were changed during this inspection.

## Workspace changes

- Staff bookings show live appointment status and payment/provider/amount for each line separately from order settlement. Two batched queries enrich only the authorized page, matching order, patient, service, doctor and linked appointment. Snapshotted prices stay unchanged. Failed payment history cannot obscure a paid or currently pending intent.
- Reception can record an actual cash receipt and accept a check-in task from a booking. The UI rereads existing tasks before creating/accepting one, so an interrupted acceptance can be retried. Multiple services retain distinct line/task actions.
- Appointment check-in requires the receptionist's accepted CHECK_IN task, rather than any accepted task. Task progress cannot bypass appointment check-in. If the doctor already started the visit, reception may record the accepted task without repeating the clinical status transition.
- Doctor actions explicitly confirm, start and complete a visit. Cancellation and no-show require confirmation. When staff cancel a visit or mark no-show, outstanding linked reception work is cancelled; completed tasks and financial history remain intact.
- Visible appointment, booking, task and dashboard views refresh every 10 seconds and when returning to the window. Hidden pages do not refresh. Concurrent background refreshes are deduplicated; errors remain handled by the query. Patient appointment details follow the refreshed row and cancel controls disappear after the visit starts.
- Clinic time uses the server's configured time zone. EN/UZ/KR labels distinguish payment awaiting receipt from appointment pending review.

## Readable references

Legacy UUID display references are compacted, e.g. APT-634260AD; sequential/non-UUID references stay unchanged. This is a display label, not a new database key or a uniqueness guarantee. All routing, mutations, ownership checks and stored references retain the complete identifiers. Patient names replace MongoDB IDs in doctor/reception appointment rows. The task form offers recent active booking appointments by service, date and reference instead of asking reception to type an ObjectId. Its chooser covers the latest 100 booking orders; direct links retain their selected appointment.

## Verification

The complete GraphQL API and real MongoDB persistence suite uses a unique disposable database, with separate patient, doctor, receptionist and admin sessions. It tests cash reservation, doctor confirmation while cash remains pending, reception queue ownership/acceptance, receipt, check-in, clinical completion, task completion, cancelled/no-show cleanup and doctor-first arrival. Existing online simulation, failed reservation, availability, promotion and ownership checks remain included.

Browser verification uses separate synthetic patient/doctor/reception sessions on isolated preview ports. The same appointment appeared CONFIRMED for the patient and receptionist while payment remained awaiting receipt; receipt changed settlement to paid; receptionist check-in reached doctor and patient; doctor completion reached patient; reception task was completed with a result. No real payment or live clinical appointment was created.

The ordinary regression suite, application builds, frontend type check, GraphQL contract checks and refresh lifecycle tests are required before applying changes.

Final results: 422 ordinary regression tests passed; 38 complete API/MongoDB persistence tests passed; 18 refresh lifecycle checks, 16 calendar checks and 35 service-option checks passed; 424 workspace documents and 120 exported frontend operations validated without contract errors; backend and frontend production builds passed.
