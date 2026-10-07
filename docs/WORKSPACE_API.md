# Role workspace APIs

Frontend workspaces reuse existing resolver → service → Mongoose domain operations and DTOs. Administrative content lists include drafts; public lists retain publication filters. Article creation requires a doctor identity, and author workspace reads are owner scoped. Comment moderation is admin only.

Hospital room listing is authenticated. Only admins can create or update rooms, and appointments require an AVAILABLE room. Reception appointment reads follow active assigned reception tasks; doctors see their own appointments. Payment lists are admin/receptionist only with bounded pagination.

Appointment linkage uses one `$elemMatch` for the requested doctor/service and unused appointment ID, together with patient ownership and confirmed order status. Retry payment keys must match the same owner, order, line, provider and method; already paid lines reuse their existing payment record. This does not claim to eliminate all concurrent provider transactions with different keys.

Image uploads await multipart promises, restrict MIME types and sizes, preserve role boundaries, and remove partial files on failure. Private notifications and reports retain existing access rules.

The offline export script `scripts/export-workspace-schema.cjs` generates GraphQL schema from the current resolvers without connecting to the database. Frontend contract verification is documented in that repository. Live merchant checkout requires provider configuration and separate acceptance testing.

## Doctor room assignment

`getAvailableDoctorRooms` is admin only. It lists registered AVAILABLE rooms without a reservation and excludes room numbers already used by nondeleted doctors, including blocked doctors and legacy records. Doctor creation normalizes the room number and atomically reserves the Room document with the new doctor ID. A failed insertion releases its own reservation; deleting the doctor releases the assignment. Room availability for appointments remains independent: assigning a doctor's office does not change `roomStatus`. Register rooms in the admin room workspace before creating a doctor. The existing `docRoom` string contract is preserved.

## Admin doctor editing

`updateDoctorByAdmin(DoctorAdminUpdateInput)` requires a verified admin identity through `RolesGuard`. It edits name, contact details, description, image, experience, specialty and ACTIVE/BLOCK status of nonarchived doctor records. Explicit field projection protects login credentials, role, counters and the assigned office. Clearing optional email uses `$unset` to preserve its sparse unique index. The admin mutation never returns a new doctor session. DELETE remains the separate `updateDoctorStatusByAdmin` removal action, including room release; archived doctors cannot be restored through profile editing.

## Authentication sessions

Existing role login/signup/social flows set HttpOnly refresh cookies. `refreshSession` rotates an owned session and returns accessToken only; `logoutSession` revokes the cookie/bearer session. Authenticated APIs verify active profile and session state. Staff creation does not issue a staff access token to the administrator. See AUTH_SESSIONS.md for configuration and verification.
