# WebSocket chat

The existing Nest `ws` gateway carries two distinct flows. The general chat is a public, in-memory room, following Nestar's `message` and `getMessages` event pattern. Connecting without a token uses the display name `Guest`. Authenticated clients may include `?token=<access token>` in the WebSocket URL; invalid supplied tokens are rejected. The server derives names from verified claims and ignores client-supplied names.

General chat protocol:

- On connection: `{ "event": "getMessages", "list": [...] }` with at most 50 recent messages.
- Send: `{ "event": "message", "data": { "text": "Hello" } }`.
- Receive: `{ "event": "message", "data": { "id", "text", "name", "role", "createdAt" } }`.
- Presence: `{ "event": "info", "totalClients", "action", "name" }`.

General messages are not written to MongoDB. They are cleared when the API process restarts.

Private profile messaging uses the same connection only when a valid access token is supplied. Clients create conversations and send messages through the existing authenticated GraphQL messaging API. After MongoDB saves a message, the server pushes `{ "event": "privateMessage", "data": { "conversationId": "...", "message": { ... } } }` to connected conversation participants. After `markMyMessagesRead` changes unread messages, it pushes `{ "event": "privateRead", "data": { "conversationId": "...", "readerId": "...", "readerType": "PATIENT", "readAt": "..." } }` to those participants. Clients should fetch conversation history through GraphQL on connection or reconnection.

The server matches each private event against the verified role and profile ID from the access token. Guests and unrelated profiles receive no private events. Private events do not enter the general room history. The realtime event bus is local to one API process; multiple API processes will need a shared pub/sub transport for cross-process delivery.
