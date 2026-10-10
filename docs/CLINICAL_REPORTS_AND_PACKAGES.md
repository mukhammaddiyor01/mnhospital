# Clinical reports, reception intake and service packages

## Visit and report workflow

A cash booking creates a pending appointment automatically; confirming the clinical visit does not settle its payment. Unassigned PENDING, CONFIRMED and IN_PROGRESS visits are visible in reception intake without requiring a pre-existing task. Unpaid online holds are excluded. Visits assigned to other receptionists remain scoped.

Reception accepts a CHECK_IN task directly from the appointment row. The backend reserves receptionTaskId atomically so competing receptionists cannot accept the same visit. Cancellation releases the matching reservation; appointment cancellation increments task versions to invalidate concurrent saves. Confirmation, check-in, doctor completion and payment receipt retain their separate existing responsibilities.

Doctors open Create report from the patient’s appointment or select an owned started/completed visit by patient, service, clinic date and readable code. Patient/doctor IDs derive from the appointment. Duplicate reports offer editing; the database keeps one report per appointment. Patient reports remain patient-owned. Receptionists see reports only for their accepted/in-progress/completed assigned work, including doctor recommendations and follow-up dates. List and open patient report details refresh while visible.

## Package configuration

Admin: Services → Booking options → choose the standard service → Add option → select additional services → enter the full package price → review total duration → create inactive → edit and publish.

Composition must include the base plus one to three distinct active non-package services from the same doctor and room. The full package price must be lower than their current separate total; duration must cover all component durations. The four-service limit per doctor/category and specialty rules remain. Packages have their own real service ID and use the existing single-doctor checkout and appointment model. Different-doctor packages are not introduced.

Patients see Standard plus explicit packages with composition, separate total, package total, savings and full duration. Unrelated standalone services no longer appear as alternatives. Components must stay active in the same room; explicit calendar dates and start/end periods are intersected. Changing a component price so the package no longer saves money disables that package for new booking. Historical booking prices and dates are preserved.

Existing standalone options are not silently converted into combined medical services. Admin must select their actual composition and approve a full package price. No real clinic records or prices were seeded during verification.

## Verification (2026-10-10)

- Backend regression: 55 suites / 419 tests passed; optional persistence suites are run separately.
- Real MongoDB API persistence: 41 cases passed using a randomly named disposable database. Includes report ownership and distribution, duplicate reports, competing reception claims, package total/duration and changed component availability/price.
- Frontend booking options 37 checks, option management 17 checks, workspace refresh 18 checks, booking calendar 16 checks and service calendar 8 checks.
- All 426 GraphQL documents validated against the generated 25-resolver schema: 172 API fields, zero errors.
- Browser using synthetic accounts and an isolated preview database: admin creates/publishes package → patient selects/buys cash-at-reception visit → reception sees intake before task → accepts → doctor confirms → reception check-in → doctor creates and edits report without typing an ID → patient and reception read it → doctor completes visit.
- Backend build and complete Next.js production build passed.
- Browser viewport override did not change the actual IAB viewport; desktop screenshots are the visual evidence. Responsive CSS retains existing mobile breakpoints.
