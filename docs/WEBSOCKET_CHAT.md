# WebSocket chat

The existing Nest `ws` gateway carries two distinct flows. The general chat is a public room backed by the `generalChatMessages` MongoDB collection, following Nestar's `message` and `getMessages` event pattern. Connecting without a token uses the display name `Guest`. Authenticated clients may include `?token=<access token>` in the WebSocket URL; invalid supplied tokens are rejected. The server derives names from verified claims and ignores client-supplied names.

General chat protocol:

- On connection: `{ "event": "getMessages", "list": [...] }` with at most 50 recent messages.
- Send: `{ "event": "message", "data": { "text": "Hello" } }`.
- Senders may add an optional `requestId` of up to 64 characters to the data. Once storage succeeds, that sender receives `{ "event": "messageSent", "requestId": "..." }`.
- Receive: `{ "event": "message", "data": { "id", "text", "name", "role", "createdAt" } }`.
- Presence: `{ "event": "info", "totalClients", "action", "name" }`.

Messages are saved before broadcasting. Connection history loads the latest 50 persisted records in chronological order, including after an API restart. The public record contains only a generated message ID, text, verified display name, role, and timestamp. Profile IDs and private messages are excluded.

Storage failures send an `error` event with `GENERAL_HISTORY_UNAVAILABLE` or `GENERAL_SEND_FAILED`. Invalid text sends `INVALID_GENERAL_MESSAGE`. Send failures echo the request ID when supplied; database details are never returned. The frontend retains a draft until its save acknowledgement arrives. When an acknowledgement cannot be confirmed, users should inspect history before resending; request IDs correlate acknowledgements and are not an idempotency guarantee.

Live messages can arrive before the connection history query completes. The frontend merges that history with messages received during loading, removes duplicate message IDs and retains the latest 50. There is no older-message pagination in the public widget; older stored records remain in MongoDB.

Private profile messaging uses the same connection only when a valid access token is supplied. Clients create conversations and send messages through the existing authenticated GraphQL messaging API. After MongoDB saves a message, the server pushes `{ "event": "privateMessage", "data": { "conversationId": "...", "message": { ... } } }` to connected conversation participants. After `markMyMessagesRead` changes unread messages, it pushes `{ "event": "privateRead", "data": { "conversationId": "...", "readerId": "...", "readerType": "PATIENT", "readAt": "..." } }` to those participants. Clients should fetch conversation history through GraphQL on connection or reconnection.

The server matches each private event against the verified role and profile ID from the access token. Guests and unrelated profiles receive no private events. Private events do not enter the general room history. The realtime event bus is local to one API process; multiple API processes will need a shared pub/sub transport for cross-process delivery.
