---
name: mn-hospital-development
description: Extend MN Hospital backend and frontend using the verified Nestar-derived conventions, hospital role boundaries, existing UI and small commits. Use for changes in mnhospital or mnhospital-next.
---

# MN Hospital development

Read the current repository's `ProjectLogic.md` and the nearest existing resolver/service or frontend flow before editing. Verify Git status and preserve preexisting changes. The repositories are separate: backend `mnhospital`, frontend `mnhospital-next`; the local `nestar` directory can be an incomplete scaffold. Use the actual Nestar backend Git repository when comparing conventions.

## Verified reference patterns

Nestar backend: `apps/nestar-api/src/components/member/member.service.ts` uses dependency injection, Mongoose, async typed methods, explicit conditions and Nest exceptions. Its resolvers use GraphQL DTOs, guards and the authenticated member decorator. Nestar frontend uses Apollo GraphQL and Axios multipart uploads in `libs/components/mypage/MyProfile.tsx` and `AddNewProperty.tsx`. Preserve these architectural patterns while adapting real estate rules to hospital rules; do not copy TODOs, loose validation or broad access as requirements.

MN backend: resolver → domain service → Mongoose model. DTOs use `@nestjs/graphql`, `class-validator` and the installed global ValidationPipe. Reuse existing enums, `AuthGuard`, `RolesGuard`, `@Roles` and `@AuthMember`. Use try/catch around meaningful external/database failure boundaries; preserve intended Nest exceptions, translate unexpected errors safely, and do not catch merely to rethrow.

## Hospital boundaries

- Patient, doctor, receptionist and admin profiles are separate collections. Identity is profile ID plus role from the verified token. Scope private reads and writes again in service queries.
- Public signup creates patients. Staff accounts and status changes follow existing administrative APIs.
- Private conversations require verified participants. Public Guest chat lives in `generalChatMessages`, latest 50 on connection, save before broadcast. AI requests never enter either room's broadcast.
- Notifications carry safe summaries and authorized resource references. Preferences are owned by profile ID and role.
- Uploads reuse the existing multipart flow. GraphQL upload scalars must bypass DTO class transformation of Promise/stream objects.
- AI provider credentials stay in backend configuration. Give an AI assistant only explicitly projected public catalog fields unless a separate authenticated operation authorizes private data. Provider failures must leave the user's draft available.

## Frontend decisions

Use the existing Next.js Pages Router, Apollo operations, Icon component, SCSS theme variables and EN/KR/UZ dictionary. Preserve container widths, advertisement rails, bottom navbar, component placement and requested animations. Staff workspaces have distinct role designs; self-profile and messaging stay in their workspace. New chat controls must not overlap existing controls, and only one panel should open at a time.

## Delivery

Commit each small coherent behavior with `feat: ...` or `fix: ...`, no scope parentheses. Stage explicit files. Verify API contract and access before connecting UI; use meaningful tests for ownership, persistence and external failure handling, plus build/type checks for changed applications. Report actual checks and remaining configuration. Do not mark AI integration complete without a configured provider and a verified live response.
