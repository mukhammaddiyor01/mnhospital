# Admin va staff GraphQL variables

Quyidagi so‘rovlar 1–4-qismlarda mavjud bo‘lgan admin, doctor, receptionist va service oqimlariga mos. Protected so‘rovlarda tegishli JWT yuboriladi:

```text
Authorization: Bearer <accessToken>
```

## Admin profile queries

```graphql
query GetDoctorsByAdmin($input: AdminDoctorInquiry!) {
  getDoctorsByAdmin(input: $input) {
    list { _id memberType memberStatus docNick }
    metaCounter { total }
  }
}
```

```json
{
  "input": {
    "page": 1,
    "limit": 10,
    "text": "doctor",
    "memberStatus": "ACTIVE"
  }
}
```

```graphql
query GetPatientsByAdmin($input: AdminPatientInquiry!) {
  getPatientsByAdmin(input: $input) {
    list { _id memberType memberStatus patientFullName }
    metaCounter { total }
  }
}
```

```json
{
  "input": {
    "page": 1,
    "limit": 10,
    "text": "patient",
    "memberStatus": "ACTIVE"
  }
}
```

```graphql
query GetReceptionistByAdmin($receptionistId: String!) {
  getReceptionistByAdmin(receptionistId: $receptionistId) {
    _id
    memberType
    memberStatus
    receptionistNick
    receptionistFullName
  }
}
```

```json
{ "receptionistId": "<receptionist-profile-id>" }
```

## Admin status updates

Patient, doctor va receptionist statuslari admin JWT orqali o‘zgartiriladi. Har bir inputda tegishli profil ID va loyiha enumidagi `memberStatus` qiymati yuboriladi.

```graphql
mutation UpdatePatientStatus($input: PatientStatusUpdateInput!) {
  updatePatientStatusByAdmin(input: $input) {
    _id
    memberStatus
  }
}
```

```json
{
  "input": {
    "_id": "<patient-profile-id>",
    "memberStatus": "BLOCK"
  }
}
```

Doctor va receptionist status mutationlari ham xuddi shu ownership va admin-role oqimi bilan ishlaydi:

```graphql
mutation UpdateDoctorStatus($input: DoctorStatusUpdateInput!) {
  updateDoctorStatusByAdmin(input: $input) { _id memberStatus }
}

mutation UpdateReceptionistStatus($input: ReceptionistStatusUpdateInput!) {
  updateReceptionistStatusByAdmin(input: $input) { _id memberStatus }
}
```

## Admin dashboard va patient activity

```graphql
query {
  getAdminDashboardStats {
    totalPatients
    activePatients
    totalDoctors
    activeDoctors
    totalReceptionists
    activeReceptionists
    totalBookings
    totalAppointments
  }
}
```

```graphql
query GetPatientActivity($patientId: String!) {
  getPatientActivityByAdmin(patientId: $patientId) {
    patient { _id memberStatus }
    bookingOrders { _id }
    services { _id }
    appointments { _id }
  }
}
```

```json
{ "patientId": "<patient-profile-id>" }
```

Doctor service/patient/appointment sonlari va receptionist task yuklamasi admin dashboard oqimida ko‘riladi:

```graphql
query GetDoctorDashboard($doctorId: String!) {
  getDoctorDashboardStatsByAdmin(doctorId: $doctorId) {
    doctorId
    serviceCount
    patientCount
    appointmentCount
    reportCount
  }
}

query GetReceptionistDashboard($receptionistId: String!) {
  getReceptionistDashboardStatsByAdmin(receptionistId: $receptionistId) {
    receptionistId
    taskCount
    pendingTaskCount
    completedTaskCount
  }
}
```

## Receptionist appointment flow

Queue faqat JWT’dagi receptionist profile ID bilan bog‘langan active reception tasklar orqali qaytadi.

```graphql
query ReceptionistQueue($input: ReceptionistAppointmentQueueInquiry!) {
  getMyReceptionistAppointmentQueue(input: $input) {
    list { _id appointmentCode appointmentStatus startsAt endsAt }
    metaCounter { total }
  }
}
```

```json
{
  "input": {
    "page": 1,
    "limit": 10,
    "status": "CONFIRMED"
  }
}
```

Receptionist check-in qilganda appointment oqimi `CONFIRMED -> IN_PROGRESS` bo‘ladi va task ownership tekshiriladi.

```graphql
mutation CheckIn($input: ReceptionistCheckInInput!) {
  checkInReceptionistAppointment(input: $input) {
    _id
    appointmentCode
    appointmentStatus
  }
}
```

```json
{
  "input": {
    "appointmentId": "<active-appointment-id>",
    "reason": "Patient arrived at reception"
  }
}
```

## Recommended services

Bu public query current active service asosida bir xil department/type bo‘yicha active recommended servicelarni qaytaradi.

```graphql
query GetRecommendedServices($serviceId: String!, $limit: Int) {
  getRecommendedServices(serviceId: $serviceId, limit: $limit) {
    list {
      _id
      serviceName
      departmentId
      serviceType
      servicePrice
    }
  }
}
```

```json
{
  "serviceId": "<current-service-id>",
  "limit": 4
}
```
