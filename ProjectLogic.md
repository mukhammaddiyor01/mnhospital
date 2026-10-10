# MN Hospital project logic

This document records the conventions used while completing the MN Hospital API. It is a guide for new modules, not a replacement for the code and tests.

## Architecture

- `apps/mnhospital-api` is the interactive GraphQL API; `apps/mnhospital-batch` is a separate batch application.
- Follow the existing Nestar-derived NestJS pattern: GraphQL resolver → domain service → Mongoose model. Keep database queries and business rules in services.
- Define GraphQL DTOs with `@nestjs/graphql` and validate inputs with `class-validator`; `main.ts` installs the global `ValidationPipe`.
- Use the existing `AuthGuard`, `RolesGuard`, `@Roles`, and `@AuthMember` conventions. Derive the acting member ID and role from the verified token, not client input. Scope reads and mutations to the owner in the service query as well as at the resolver boundary.
- Extend the existing domain models and enums before introducing parallel representations of the same data.

## Hospital-specific boundaries

- Doctor specialties are distinct from service categories. `doctor-specialty.policy.ts` maps all 13 specialties to allowed service types: five generic categories plus the matching clinical direction. Create, type changes and reactivation check the stored doctor's specialty; admin edits use the same policy. A specialty change cannot invalidate ACTIVE/RESERVED/STARTED services. Existing enum values and historical records remain unchanged.

- Public signup creates a patient account; staff roles are managed through their existing administrative flows.
- Notification records are private to `receiverId` and `receiverType`. Public notices are a separate model and only published notices are visible without authentication.
- Notification creation is internal to the API. Appointment, booking, payment, reception task, report, and direct message changes emit the events recorded in `docs/NOTIFICATION_EVENTS.md`; the API does not expose a public create mutation.
- Direct messaging belongs to authenticated patient, doctor, receptionist, and admin profiles. Store each participant as a role plus profile ID because staff and patients live in different collections. Scope every conversation and message operation to a participant. The public Guest live chat is a separate WebSocket flow.
- Send private message and read receipt WebSocket events only to verified conversation participants after the GraphQL service has saved the change. Load missed messages through the scoped GraphQL queries.
- Save public Guest live chat in the separate `generalChatMessages` collection before broadcasting. Load its latest 50 messages on connection. Persist only public display fields; keep direct conversations and participant IDs out of the public history.
- Store UI preferences by the verified profile ID and role, since patient and staff profiles use separate collections. Return defaults without creating a record; apply partial updates only to the authenticated active profile.
- Do not place detailed clinical information in notification title or description. Link to the authorized resource through `notificationGroup` and `notificationRefId`.

## Change discipline

- Public booking selects a clinic date, a real catalog service and a server-provided time, then opens the owned checkout. `createAppointmentBooking` snapshots a single booking in an isolated checked-out cart. `chooseBookingPayment` creates its payment intent and appointment automatically in the doctor assigned room. Cash remains pending until reception confirms payment; online checkout reserves the time for 15 minutes. Local test outcomes require explicit development simulation and persisted test intents. Payment and appointment status are separate. Read `docs/BOOKING_CHECKOUT.md`.
- Booking cancellation also cancels pending payments, appointments and their active reception tasks. A started appointment prevents order cancellation. Paid orders become COMPLETED after all linked appointments complete. Clinic currency and time zone come from server settings.

- Doctor booking requests use the authenticated doctor ID, filter each order line again after unwinding multi-doctor orders, and expose scheduling fields only. Receptionists use their existing booking list. The appointment queue includes unassigned active intake (excluding unpaid online holds) and their active assigned visits; another receptionist’s assigned work stays scoped. Accepting CHECK_IN reserves the appointment atomically before clinical actions; reports remain limited to accepted, in-progress or completed assigned work.

- Commit one coherent behavior with its relevant verification. Keep unrelated domain changes in separate commits.
- Before connecting a new frontend flow, verify its GraphQL contract, role access, ownership, and validation in the API.

## Homepage AI assistant

- `AiChatModule` follows the resolver → service pattern and uses the installed Nest Axios module for the external provider. Read `docs/AI_ASSISTANT.md` for its current limits and configuration.
- Homepage AI assistance is a public, stateless operation. Project only explicitly allowed public catalog fields; keep private profile, medical report, direct message and appointment data out of provider requests. Render plain text and use fixed application links.
- Never log raw AI questions, answers or Axios errors. Missing provider configuration must be shown honestly; preserve drafts when requests fail. Private AI conversations and authenticated tools require their own ownership design before implementation.

## Authentication session boundaries

- Keep login identities in their existing role collections; the medical Patient profile is not the patient login account.
- Login/refresh/logout use the Auth service and GraphQL session interceptors. Refresh secrets belong in HttpOnly cookies and hashed role/profile-owned session records; never expose them in GraphQL or logs.
- Authenticated guards recheck session and active profile state. BLOCK/DELETE and password changes invalidate old profile session versions; reactivation cannot restore those credentials.
- Preserve the current session during contact edits. Only password changes replace the browser session after revoking old sessions. Staff creation must not authenticate the administrator as that staff member.
- Read docs/AUTH_SESSIONS.md for cookie/origin configuration, rotation/replay rules, deployment behavior and regression verification.

- Self-service account edits use the verified role/profile ID and allow only stored personal fields. Doctor specialty and room, roles, statuses, derived counters and clinical assignments remain under their existing management flows. All roles may upload their own avatar and change their password after verifying the current password; a password change revokes previous sessions.

- Browser parallel roles use the existing role collections and auth sessions: per-tab access JWT, four role-scoped HttpOnly refresh cookies, unchanged verified JWT/role/owner guards. The header selects a cookie and never grants privileges. One active account per role per browser profile; same-role replacement must not affect the other three roles. Read docs/ROLE_SESSIONS.md.

- Service availabilityDates selects clinic calendar dates on a single service (empty/missing means weekly schedule). Public slots and new booking writes intersect these dates with existing doctor schedules, breaks, service duration, room and appointments; date edits preserve existing bookings. Read docs/SERVICE_CALENDAR.md.

- Admin service discount percentages preserve the service base price. Booking snapshots include base/service/promo amounts; one patient-owned promo code applies after the service discount. First payment atomically locks pricing. Archive promo codes without deleting historical references; legacy unsnapshotted orders retain their original flow. Read docs/PROMOTIONS.md.

- Admin booking packages explicitly link a standard service and one to three additional active services from the same doctor and room. `createServiceOptionByAdmin` and `updateServiceOptionByAdmin` validate the composition, full package price below separate purchase total, and enough combined visit time. Packages start INACTIVE, remain real services and reuse existing single-doctor appointment and payment snapshots. Public booking options include only the standard service and its explicit packages; unrelated services are no longer options. Component calendars and current availability intersect at booking. The four-services-per-doctor/type limit and specialty policy remain unchanged; general service creation stays DOCTOR-only. See docs/CLINICAL_REPORTS_AND_PACKAGES.md.

- Doctor and service views follow the Nestar rule: increment only when a new authenticated viewer/target/group view is recorded. Doctor views now use the shared ViewService and `view_actor_target_unique` index. Anonymous reads and internal metadata lookups never increment these counters; reloads, return visits and parallel requests by the same viewer reuse the existing record. Existing historical totals are retained.

- Public appointment calendars discover actual available days through `getAvailableDoctorDates`, reusing the exact-day slot calculation with a single monthly appointment read. Empty-date reasons explain missing schedule/room or invalid/ended service periods; no default clinical availability is invented. Existing patient checkout ownership, server pricing and reservation validation remain unchanged.

## Shared appointment state

Doctor confirmation updates clinical appointmentStatus; it does not mark a cash receipt or settle the order. Staff booking lines expose their live linked appointment/payment state without changing price snapshots. Reception check-in uses its own accepted CHECK_IN task; if the doctor already started, recording reception arrival must not repeat or revert the clinical transition. Cancel/no-show closes outstanding reception work. UI reference shortening must never replace complete backend IDs. See docs/APPOINTMENT_ROLE_FLOW.md.

Doctors choose an owned IN_PROGRESS, ENDED or COMPLETED patient visit through getMyDoctorReportAppointments; report creation derives doctor and patient from that appointment. One report per appointment is enforced. UI never requires typing an appointment ID. Patients read their own report; receptionist report access requires accepted assigned work.

Unread badges use authenticated receiver role/profile counts and owned direct-conversation incoming message counts. Reading a conversation clears its existing MESSAGE notifications only; notification bulk reads do not mark messages read. Client counters share one account-scoped provider and reuse authorized private events with visible polling/focus recovery. See docs/UNREAD_INDICATORS.md.
