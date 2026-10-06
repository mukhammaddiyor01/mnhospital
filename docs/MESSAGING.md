# Direct messaging

The authenticated messaging area in each role's profile uses `Conversation` and `Message` records. A conversation has two participants, each identified by `participantType` and `participantId`; this is necessary because patients, doctors, receptionists, and admins use different profile collections. The canonical `directKey` makes starting the same pair of profiles idempotent. Patient-to-patient chats are not enabled.

GraphQL operations:

- `startDirectConversation(input: { targetType, targetId })`
- `getMyConversations(input: { page, limit })`
- `getMyConversation(conversationId)`
- `getMyMessages(conversationId, input: { page, limit })`
- `sendDirectMessage(conversationId, input: { messageContent, replyToMessageId? })`
- `markMyMessagesRead(conversationId)`

Message pages are newest first. Every read and mutation checks that the verified role and profile ID belong to the conversation. Sender identity comes from the verified token, never from the input. Display names and images are stored as conversation participant snapshots when the conversation is created.

The floating general live chat, including Guest users, is separate and will be implemented with the WebSocket stage. It must not expose private direct messages to that room.

Each saved direct message creates a generic `MESSAGE` notification for the other participant. The notification points to the conversation and does not include message text or clinical details.
