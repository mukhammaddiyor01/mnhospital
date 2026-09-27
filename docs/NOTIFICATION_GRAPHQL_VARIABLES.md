# Notification va Notice GraphQL variables

Protected notification so‘rovlarda JWT profile ID va role context sifatida ishlaydi:

```text
Authorization: Bearer <accessToken>
```

## My notifications

Patient, doctor, receptionist va admin o‘z notificationlarini bir xil query orqali oladi.

```graphql
query GetMyNotifications($input: NotificationInquiry!) {
  getMyNotifications(input: $input) {
    list {
      _id
      notificationType
      notificationStatus
      notificationGroup
      notificationTitle
      notificationDesc
      notificationRefId
      createdAt
    }
    metaCounter { total }
  }
}
```

```json
{
  "input": {
    "page": 1,
    "limit": 10,
    "notificationStatus": "UNREAD",
    "notificationType": "APPOINTMENT",
    "notificationGroup": "APPOINTMENT"
  }
}
```

`notificationGroup` event reference turini bildiradi: `APPOINTMENT`, `BOOKING_ORDER`, `PAYMENT`, `RECEPTION_TASK`, `REPORT` yoki `SYSTEM`.

## Read and archive

```graphql
mutation MarkNotificationRead($notificationId: String!) {
  markMyNotificationRead(notificationId: $notificationId) {
    _id
    notificationStatus
  }
}
```

```json
{ "notificationId": "<notification-id>" }
```

```graphql
mutation {
  markAllMyNotificationsRead
}
```

```graphql
mutation ArchiveNotification($notificationId: String!) {
  archiveMyNotification(notificationId: $notificationId) {
    _id
    notificationStatus
  }
}
```

Notification statusini boshqa user o‘zgartira olmaydi; receiver JWT’dan olinadi.

## Public published notices

```graphql
query GetPublishedNotices($input: NoticeInquiry!) {
  getPublishedNotices(input: $input) {
    list {
      _id
      noticeCategory
      noticeStatus
      noticeTitle
      noticeContent
      createdAt
    }
    metaCounter { total }
  }
}
```

```json
{
  "input": {
    "page": 1,
    "limit": 10,
    "noticeCategory": "SYSTEM"
  }
}
```

Bu query faqat `PUBLISHED` notice’larni qaytaradi va authentication talab qilmaydi.

## Admin notice flow

```graphql
mutation CreateNotice($input: NoticeInput!) {
  createNotice(input: $input) {
    _id
    noticeCategory
    noticeStatus
    noticeTitle
    authorId
    authorType
  }
}
```

```json
{
  "input": {
    "noticeCategory": "SYSTEM",
    "noticeTitle": "Maintenance notice",
    "noticeContent": "System maintenance is scheduled"
  }
}
```

Notice avval `DRAFT` holatda yaratiladi. Admin keyin publish yoki archive qiladi:

```graphql
mutation UpdateNotice($input: NoticeUpdateInput!) {
  updateNotice(input: $input) {
    _id
    noticeStatus
    noticeTitle
  }
}
```

```json
{
  "input": {
    "_id": "<notice-id>",
    "noticeStatus": "PUBLISHED"
  }
}
```

```graphql
mutation ArchiveNotice($noticeId: String!) {
  archiveNotice(noticeId: $noticeId) {
    _id
    noticeStatus
  }
}
```

`createNotice`, `getNoticesByAdmin`, `updateNotice` va `archiveNotice` faqat admin JWT bilan ishlaydi.
