# User preferences API

Authenticated patient, doctor, receptionist, and admin profiles can read and update their own display preferences. The API derives the role and profile ID from the access token. Preferences are stored under a unique `(ownerId, ownerType)` key, so profile IDs from different role collections cannot overlap.

`getMyPreferences` returns `{ theme: LIGHT, language: EN }` when no preference document exists. The first update creates the document. `updateMyPreferences` accepts one or both fields and leaves omitted fields unchanged; an empty update is rejected. Only active profiles can use these operations.

```graphql
query GetMyPreferences {
  getMyPreferences { theme language }
}

mutation UpdateMyPreferences($input: UpdateMyPreferencesInput!) {
  updateMyPreferences(input: $input) { theme language }
}
```

Allowed themes: `LIGHT`, `DARK`, `SYSTEM`. Allowed languages: `KR`, `UZ`, `EN`. The frontend dark/light and localization stages will consume these values; this API stores the selection and does not translate existing content by itself.
