# First admin account

The admin sign-in page uses `loginAdmin`, which looks up an exact `adminNick` in the MongoDB `admin` collection. There is no public admin registration mutation.

From the backend repository root, check the configured database without changing it:

```bash
npm run db:bootstrap-admin
```

If the database contains no admin, create the first account in an interactive terminal:

```bash
npm run db:bootstrap-admin -- --apply
```

Enter the admin nickname, phone, email, and password at the prompts. The password is hidden while typing and is stored as a bcrypt hash. The script requires an explicit `CREATE` confirmation, refuses to add an admin when one already exists, and checks that the configured database is `MNHospital`. It uses `MONGO_DEV` unless `NODE_ENV=production`, in which case it uses `MONGO_PROD`.

Sign in with the exact nickname and password at `/account/admin-signin`, then open `/mypage/dashboard`.
