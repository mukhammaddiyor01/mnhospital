# Patient optional field indexes

`patientPhone`, `patientMail`, and `patientNick` are optional patient fields. Their schema declares unique sparse indexes, but older databases can still have non-sparse unique indexes. A second patient profile without these fields then fails with `E11000 ... dup key: { patientPhone: null }` (or the corresponding mail/nick field).

From the backend root, inspect the pending changes, then apply the migration against `MONGO_DEV` in `.env`:

```sh
npm run db:repair-patient-indexes
npm run db:repair-patient-indexes -- --apply
```

The script checks the database name, index definitions, and explicit null values before changing anything. It replaces only the three optional-field indexes with unique sparse indexes and can be rerun. `memberId` and `patientIdNumber` indexes are untouched.

Account phone numbers belong to `Member.memberPhone`. `createPatientProfile` does not accept a separate phone number; patient contact information should use the member account.
