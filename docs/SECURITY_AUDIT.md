# MN Hospital final repository audit — 2026-10-08

## Result and immediate action

The backend's current `EXIMBAY_API_KEY` value was found verbatim in three historical versions of `docs/EXIMBAY_NEXTJS_INTEGRATION.md` reachable from the fetched GitHub history. Introduction: `a10b8ebada388aeff4171f23a0ef1177b7df2a5c`. The current document now has empty configuration fields and contains no provider credential. The key must be revoked or rotated in the Eximbay account; removing a document does not revoke it. Its operational validity was not tested. Both repositories are private, but collaborators and existing clones may retain historical values.

Rotate first, then decide with collaborators whether to purge published history. This audit does not rewrite or force-push GitHub history. GitHub's procedure: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

## Scope and credential findings

- Fetched all configured origin branches and tags in both repositories. Inspected all reachable local/ref/reflog Git blobs and ran Gitleaks 8.30.1 on full Git history with completely redacted reports. Compared current local environment credentials against historical blobs without printing values.
- Backend `.env`, frontend `.env` and `.env.local` are ignored and untracked. No private `.env` filename was found in Git history; `.env.example` templates are tracked intentionally. Current MongoDB, JWT, OAuth client secret and AI provider secret values were not found in the inspected histories.
- Backend Gitleaks initially returned six findings: one historical provider credential, four artificial regression password findings, and a legacy public Nest template CircleCI badge token. Removed the badge token from the current README. The scanner allows only the exact artificial password fixtures, never real provider keys or whole test directories. Frontend full-history scan returned zero findings.
- Frontend `NEXT_PUBLIC_KAKAO_REST_API_KEY` is used as the browser OAuth client identifier, as required by Kakao. It is not the separate OAuth client secret. Browser credentials that authorize private provider operations must remain in backend configuration. Reference: https://developers.kakao.com/docs/en/kakaologin/rest-api
- Authenticated GitHub API confirmed both repositories are private. Issues/PR descriptions, issue comments, commit comments and releases returned zero entries. Repository Actions secrets and variables returned zero entries. GitHub secret-scanning alerts returned 404 and Dependabot alerts returned 403; these alerts were unavailable, not verified empty. Organization/environment secrets, collaborators' clones, deleted/unreachable GitHub objects and Actions artifact/log contents were not audited.
- Git author identities are ordinary repository attribution, not authentication secrets. No assertion is made that every historical credential can be detected: exact matching only covers current local values, complemented by Gitleaks patterns.

## Prevention added

- `node scripts/verify-repository-security.cjs`: checks tracked paths for private environment/credential files and compares current nonpublic local credential values with tracked working files. It never prints secret values. This complements pattern scanning; it is not a complete dotenv parser or replacement for provider-side rotation.
- `.github/workflows/secret-scan.yml`: read-only GitHub workflow on pushes, PRs and manual runs. Scans the complete committed HEAD snapshot with Gitleaks, a checksum-verified pinned binary, and fully redacted output. Does not require a paid Gitleaks action license for a private repository.
- `.gitleaks.toml`: default detector rules plus an exact artificial-fixture allowance. Existing `.gitignore` protects local environment files, certificates, credential JSON, uploads and generated artifacts. Preexisting unrelated working changes remain unstaged.
- Full-history scanning remains necessary: `gitleaks git . --log-opts='--all' --config .gitleaks.toml --redact=100`. The known historical provider credential remains detectable until published history is purged. The CI snapshot scan intentionally does not claim to sanitize past commits.

## Production dependency audit

`npm audit --omit=dev --json` was run against each actual lockfile. Counts reflect advisory aggregation, not a count of independently demonstrated exploits.

| Repository | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 1 | 16 | 13 | 1 | 31 |
| Frontend | 2 | 2 | 1 | 0 | 5 |

Backend findings include proxy-addr, Apollo/Nest GraphQL dependency chains, multipart upload packages and ws. Frontend findings include Next.js 13.4.19, Swiper 11.2.10, PostCSS and source-map-js. Next.js and Swiper need migration to versions outside all reported vulnerable ranges; blindly accepting the npm suggested older Next 13 minor would not resolve all advisories. Package upgrades and behavioral regression verification remain required before treating this as production-ready. No dependency versions were changed in this repository/history audit.

## Functional verification

- Backend: 393 unit tests passed; 13 integration tests were skipped by the unit run, then all 13 checkout persistence tests passed in an isolated real MongoDB database.
- Authentication/access: 248 backend role/session checks; 42 frontend authentication checks.
- Service calendar: 8 checks. Specialty compatibility/localization, signup validation and dark-mode contrast regression scripts passed.
- GraphQL: 395 documents checked against 160 API fields, zero errors. Fixed the audit helper to validate reusable standalone fragments without treating them as unused operations; composed queries retain all validation rules. Regenerated API coverage.
- Profile presentation: 39 read-only checks passed with TypeScript path aliases and SCSS module loading supplied by the audit harness.
- Backend and frontend production builds passed in temporary copies, preserving the running development servers. These checks validate covered behavior, not every possible hospital workflow or deployment configuration.

## Commit history decision

224 backend commits and 322 frontend commits were reachable from fetched `origin/develop` at audit time. GitHub was not observed to have 332 frontend commits on that branch. Commit totals alone do not indicate poor code quality; coherent reviewable changes and useful history matter more.

Only unpublished linear development history is consolidated. Backend: the five incremental patient/checkout/persistence/KRW/availability commits become one coherent booking feature, reducing the original 12 unpublished commits to 8. Frontend: two directory-card commits become one; four successive thumbnail/gallery/card-navigation/article-image commits become one, reducing the original 15 unpublished commits to 11. Independent role sessions, calendars, validation, duration and theme changes retain separate commits. Each repository then receives one audit/security commit.

Final expected unpublished totals: backend 9, frontend 12; local develop totals 233 and 334. Final committed tree hashes must exactly equal their pre-consolidation tree hashes. Backup refs retain the original local history; working files and index are not reset. Nothing is pushed during this audit.
