# Doctor specialty and service categories

The existing seven specialties retain their stored values. Six additional values cover the missing directions: UROLOGIST, OPHTHALMOLOGIST, NEUROSURGEON, PLASTIC_SURGEON, OBSTETRICIAN_GYNECOLOGIST and FAMILY_PHYSICIAN. No automatic record migration occurs.

The backend owns the category mapping in `doctor-specialty.policy.ts`. These are application service categories, not verification of clinical qualifications. CONSULTATION, DIAGNOSTIC, PROCEDURE, THERAPY and LABORATORY are generic categories for every assigned specialty.

| Specialty | Additional service type |
| --- | --- |
| GENERAL_PRACTITIONER | FAMILY_MEDICINE |
| CARDIOLOGIST | CARDIOLOGY |
| DERMATOLOGIST | DERMATOLOGY |
| NEUROLOGIST | NEUROLOGY |
| PEDIATRICIAN | PEDIATRICS |
| SURGEON | Generic categories only |
| DENTIST | DENTISTRY |
| UROLOGIST | UROLOGY |
| OPHTHALMOLOGIST | OPHTHAL |
| NEUROSURGEON | NEUROSURGERY |
| PLASTIC_SURGEON | PLASTIC_SURGERY |
| OBSTETRICIAN_GYNECOLOGIST | OBSTETRICS_GYNECOLOGY |
| FAMILY_PHYSICIAN | FAMILY_MEDICINE |

`getMyDoctorServiceTypes` is doctor-only and derives its profile ID from the authenticated session. The doctor service form loads this list instead of maintaining a second frontend mapping. An unassigned specialty returns an empty list and disables service creation until an admin sets it. Admin service type edits and reactivation validate the actual service owner through the same policy.

Before changing a doctor's specialty, the backend rejects any incompatible ACTIVE, RESERVED or STARTED services. Change or deactivate those services first. Historical records are not rewritten; archiving remains available, and reactivation checks compatibility.

Admin doctor create/edit and public doctor filters show all 13 specialties with EN/UZ/KR labels. All 16 service categories also have EN/UZ/KR labels.

Verification: specialty/service mapping, owned query role policy, create/update/reactivation failures, archive behavior and specialty-change consistency tests. The frontend specialty catalog verification checks enum parity against the exported schema and labels in all three languages.
