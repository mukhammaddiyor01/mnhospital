# Receptionist GraphQL variables

Receptionist public signup mavjud emas. Receptionist profili faqat admin tokeni bilan yaratiladi; receptionist esa o‘z login tokeni bilan profil va task oqimidan foydalanadi.

## Login

```graphql
mutation LoginReceptionist($input: ReceptionistLoginInput!) {
  loginReceptionist(input: $input) {
    _id
    memberType
    receptionistNick
    accessToken
  }
}
```

```json
{
  "input": {
    "receptionistNick": "frontdesk01",
    "receptionistPassword": "password123"
  }
}
```

Natijadagi `accessToken` keyingi protected so‘rovlarda `Authorization: Bearer <accessToken>` header sifatida yuboriladi.

## Admin creates receptionist

```graphql
mutation CreateReceptionist($input: ReceptionistInput!) {
  createReceptionist(input: $input) {
    _id
    memberType
    receptionistNick
    receptionistFullName
  }
}
```

```json
{
  "input": {
    "receptionistNick": "frontdesk01",
    "receptionistPassword": "password123",
    "receptionistPhone": "+821012345678",
    "receptionistMail": "frontdesk01@mnhospital.test",
    "receptionistFullName": "Front Desk"
  }
}
```

Bu mutation faqat `memberType: ADMIN` JWT bilan ishlaydi.

## Reception task

```graphql
mutation CreateReceptionTask($input: ReceptionTaskInput!) {
  createReceptionTask(input: $input) {
    _id
    appointmentId
    patientId
    doctorId
    receptionistId
    taskStatus
  }
}
```

```json
{
  "input": {
    "appointmentId": "<active-appointment-id>",
    "taskType": "CHECK_IN",
    "taskPriority": "MEDIUM",
    "taskInstruction": "Confirm the appointment details"
  }
}
```

`appointmentId` active appointment bo‘lishi kerak. Receptionist `receptionistId` yubormasa, ownership JWT’dagi receptionist profile ID orqali belgilanadi.

## Reception task status

```graphql
mutation UpdateReceptionTaskStatus($input: ReceptionTaskStatusInput!) {
  updateReceptionTaskStatus(input: $input) {
    _id
    taskStatus
    taskResult
  }
}
```

```json
{
  "input": {
    "taskId": "<reception-task-id>",
    "taskStatus": "ACCEPTED"
  }
}
```

Status transition mavjud oqim bo‘yicha ketadi: `PENDING -> ACCEPTED -> IN_PROGRESS -> COMPLETED`. Boshqa receptionist taskini o‘zgartira olmaydi; `COMPLETED` qilishda `taskResult` talab qilinadi.
