# Owned account profiles

All four roles use `updateMyAccountProfile` and `changeMyAccountPassword`. The resolver derives the owner and collection from the authenticated session; input cannot select another owner, role or status.

| Role | Editable account fields |
| --- | --- |
| Patient | Nickname, full name, phone, optional email, avatar, description |
| Doctor | Nickname, full name, phone, optional email, address, avatar, description, experience |
| Receptionist | Nickname, full name, phone, required email, address, avatar, description |
| Admin | Nickname, phone, required email, avatar, description |

The medical Patient profile keeps its existing owned medical form. Doctor specialty and room remain administrator assignments. Roles, account statuses and derived statistics are excluded from self-service edits.

Profile writes validate fields, preserve the current session and renew display claims. Password writes require the current password and a different replacement of 8–32 characters. An atomic credential/session-version check prevents concurrent stale writes; all previous sessions are revoked and a new HttpOnly refresh session is issued. Cookie origin/CSRF checks run before a password write.

The existing multipart image uploader now supports an admin-owned target alongside patient, doctor and receptionist targets. Existing image type, size and role checks apply.

Validation: account-profile unit tests cover all roles, wrong passwords, privilege-field injection and CSRF. The isolated verify-auth-access script persists owned image/description edits and verifies password hashing, new login, and rejection of previous access/refresh credentials for each role.
