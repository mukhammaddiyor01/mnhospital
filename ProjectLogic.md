# MN Hospital project logic

This document records the conventions used while completing the MN Hospital API. It is a guide for new modules, not a replacement for the code and tests.

## Architecture

- `apps/mnhospital-api` is the interactive GraphQL API; `apps/mnhospital-batch` is a separate batch application.
- Follow the existing Nestar-derived NestJS pattern: GraphQL resolver → domain service → Mongoose model. Keep database queries and business rules in services.
- Define GraphQL DTOs with `@nestjs/graphql` and validate inputs with `class-validator`; `main.ts` installs the global `ValidationPipe`.
- Use the existing `AuthGuard`, `RolesGuard`, `@Roles`, and `@AuthMember` conventions. Derive the acting member ID and role from the verified token, not client input. Scope reads and mutations to the owner in the service query as well as at the resolver boundary.
- Extend the existing domain models and enums before introducing parallel representations of the same data.

## Hospital-specific boundaries

- Public signup creates a patient account; staff roles are managed through their existing administrative flows.
- Notification records are private to `receiverId` and `receiverType`. Public notices are a separate model and only published notices are visible without authentication.
- Notification creation is internal to the API. Appointment, booking, payment, reception task, report, and direct message changes emit the events recorded in `docs/NOTIFICATION_EVENTS.md`; the API does not expose a public create mutation.
- Direct messaging belongs to authenticated patient, doctor, receptionist, and admin profiles. Store each participant as a role plus profile ID because staff and patients live in different collections. Scope every conversation and message operation to a participant. The public Guest live chat is a separate WebSocket flow.
- Send private message and read receipt WebSocket events only to verified conversation participants after the GraphQL service has saved the change. Load missed messages through the scoped GraphQL queries.
- Store UI preferences by the verified profile ID and role, since patient and staff profiles use separate collections. Return defaults without creating a record; apply partial updates only to the authenticated active profile.
- Do not place detailed clinical information in notification title or description. Link to the authorized resource through `notificationGroup` and `notificationRefId`.

## Change discipline

- Commit one coherent behavior with its relevant verification. Keep unrelated domain changes in separate commits.
- Before connecting a new frontend flow, verify its GraphQL contract, role access, ownership, and validation in the API.
