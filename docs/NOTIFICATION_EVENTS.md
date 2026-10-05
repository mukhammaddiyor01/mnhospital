# Notification event contract

Notification writes occur after the associated domain operation has been persisted. The notification feed remains private to the authenticated receiver (`receiverId` and `receiverType`). Public notices use a different model.

| Domain event | Receiver | Reference group |
| --- | --- | --- |
| Appointment request created | Patient and doctor | `APPOINTMENT` |
| Appointment cancelled by patient | Doctor | `APPOINTMENT` |
| Appointment status changed | Patient; doctor also receives staff confirmation | `APPOINTMENT` |
| Booking order created, cancelled, or confirmed | Patient | `BOOKING_ORDER` |
| Payment status changed by staff or Eximbay | Patient | `PAYMENT` |
| Reception task assigned | Assigned receptionist | `RECEPTION_TASK` |
| Reception task completed | Doctor | `RECEPTION_TASK` |
| Doctor report created or updated | Patient | `REPORT` |

Patient profile IDs are resolved to their linked `Member` account IDs before delivery; doctor and receptionist account IDs are used directly. Events carry a stable key with receiver type and ID so repeated callbacks do not insert duplicate notifications. Report update keys include the saved revision timestamp.

Notification text is deliberately generic. Clinical details remain behind the resource's authorized API. Notification creation errors are logged and do not roll back a completed booking, payment, appointment, task, or report operation. This direct write path has no durable retry queue yet; an outbox would be needed if guaranteed delivery becomes a requirement.

`MESSAGE` notifications are reserved for the messaging stage and are not emitted before conversations and participant permissions exist.
