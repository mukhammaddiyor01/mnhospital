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

- The public appointment wizard creates a booking order. Payment confirmation makes the order eligible for the patient to create an appointment; it does not create one automatically.
- Doctor booking requests use the authenticated doctor ID, filter each order line again after unwinding multi-doctor orders, and expose scheduling fields only. Receptionists use their existing booking list, while their appointment queue remains limited to active assigned reception tasks.

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
