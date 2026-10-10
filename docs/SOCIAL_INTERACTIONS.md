# Community follow, likes and views

Community follow is available to authenticated active patients and doctors. Targets stay in the existing `members` and `doctors` collections. Receptionist/admin workspaces do not gain social follow actions. Self-follow and following inactive targets are rejected. Repeating subscribe returns the existing relationship and changes counters only for a new pair. Unfollow removes the authenticated actor's relation and adjusts the existing target/actor counters.

The obsolete `followingMemberId_1_followerMemberId_1` unique index must be removed using the existing `scripts/repair-follow-indexes.js` procedure. It is incompatible with current `followingId`/`followerId` records. No profile or follow records are deleted by that repair.

Likes continue to toggle the existing `likes` collection. Only an actual record deletion decrements the counter; only a successful new insertion increments it. A concurrent duplicate insertion leaves the count unchanged. Mutations return the viewer's `meLiked` state so the UI follows persisted results. Public member queries return like/view totals; the frontend like mutation selects public social fields only. Failed writes show a translated error and rapid repeated clicks are locked.

Patient profiles, services and articles record one view per authenticated viewer/target/group. Patient owners do not count their own profile reads. The unique `view_actor_target_unique` index prevents parallel requests from creating duplicate views. Reads touch the existing visit timestamp to retain recently visited service order. Doctor profile views use the same one-view-per-authenticated-viewer rule through `ViewGroup.DOCTOR`. Anonymous doctor/service reads do not create views. Internal doctor metadata reads during follow, service and article loading do not increase doctor page views.

For an existing database, run `node scripts/ensure-view-pair-index.js .env` to inspect, then append `--apply` to create the view index. It refuses duplicate pairs rather than removing existing view records. Older nonunique indexes can remain.

Verification adds real API/Mongo cases for concurrent follow, self/unauthenticated/staff restrictions, follow counter reversal, doctor follow without page views, concurrent unique profile/service views, owner view exclusion and persisted/concurrent like counts. Fixtures use the existing disposable `mn_flow_<id>` database workflow.
