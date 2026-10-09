# Follow index repair

The Follow schema stores `followingId` and `followerId`. Databases that still have
the old unique `followingMemberId_1_followerMemberId_1` index reject the second
current-schema follow with an E11000 `{ followingMemberId: null, followerMemberId: null }`
error. Updating a Mongoose schema does not remove previously created indexes.

Preview the repair with `npm run db:repair-follow-indexes`. Apply it with
`npm run db:repair-follow-indexes -- --apply`. The command uses `MONGO_DEV`, or
`MONGO_PROD` when `NODE_ENV=production`, and requires the `MNHospital` database.

The repair checks records and index definitions first, ensures the current pair
has a unique index, then drops only the obsolete compound unique index. It does
not modify follow records or profile counters, and is safe to run again. Legacy
records, invalid IDs and duplicate pairs stop the repair for a separate data
migration. No API restart is required for the index change.

Unit coverage: `npm test -- --runInBand --runTestsByPath apps/mnhospital-api/src/components/follow/follow-indexes.spec.ts`.
To verify against MongoDB, set `MN_FOLLOW_TEST_URI` and run
`npm test -- --runInBand --runTestsByPath apps/mnhospital-api/test/follow-indexes.persistence.spec.ts`.
The persistence test reproduces the error and validates the repair in a new
`mn_follow_<ObjectId>` database, which it removes afterward. It never writes to
the application database.
