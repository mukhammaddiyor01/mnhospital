# Appointment flow verification

Story: patient selects a real service, an available clinic date and time; the API creates the owned order; choosing cash creates the appointment and pending payment in MongoDB.

| Boundary | Evidence |
| --- | --- |
| Frontend calendar → GraphQL | Month-specific dates and exact-day slots appeared in the browser; only returned dates enabled. |
| Guest → login → booking | Selected service and date survived the login redirect; time was checked again. |
| Booking → checkout | Browser reached the owned payment page with the same service, clinic timestamp and 150,000 KRW fixture price. |
| Checkout → MongoDB | Synthetic appointment persisted at 2026-10-13T00:00:00Z through 00:30:00Z, PENDING; CASH payment persisted at 150,000 KRW, PENDING. |
| Ownership and concurrency | 34 complete API/Mongo persistence tests passed in a separately named disposable database. |
| Regression | 419 tests passed; 16 frontend calendar checks; backend/frontend builds; 422 frontend documents validated against 169 API fields with no errors. |

## Actual catalog configuration found

The original application database was inspected without manually changing service periods, doctor hours or rooms. Several empty slot responses were legitimate consequences of stored configuration:

- Dentistry / DR John: closedAt was 2026-10-09T09:30:00Z, so the booking period had ended. docRoom was `204`, while the catalog contained `r204` rather than `204`. The admin must choose the intended valid period in `/admin/services?view=catalog` and the correct assigned room in `/admin/doctors`.
- Neurosurgery / DR Martin: doctor room `303` had no corresponding available room. `r303` belonged to another doctor and must not be reassigned automatically.
- Men's Health Issues / Dr Kevin: openedAt followed closedAt. The admin must correct the service interval.
- Several service owners had no active weekly schedule. Their doctor must configure `/doctor-workspace/schedule`; service date selection does not replace working hours.
- Urology Consultation's selected October days did not include the doctor's Tuesday working day. Service dates and working schedule must intersect.

The frontend previously used an unrestricted date input and did not discover bookable dates. It now reports the specific stored configuration problem instead of making the patient guess another date. Real catalog dates will appear only when the existing clinical constraints permit booking.
