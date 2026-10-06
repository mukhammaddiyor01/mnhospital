# WebSocket chat

The existing Nest `ws` gateway carries two distinct flows. The general chat is a public, in-memory room, following Nestar's `message` and `getMessages` event pattern. Connecting without a token uses the display name `Guest`. Authenticated clients may include `?token=<access token>` in the WebSocket URL; invalid supplied tokens are rejected. The server derives names from verified claims and ignores client-supplied names.

General chat protocol:

- On connection: `{ "event": "getMessages", "list": [...] }` with at most 50 recent messages.
- Send: `{ "event": "message", "data": { "text": "Hello" } }`.
- Receive: `{ "event": "message", "data": { "id", "text", "name", "role", "createdAt" } }`.
- Presence: `{ "event": "info", "totalClients", "action", "name" }`.

General messages are not written to MongoDB. They are cleared when the API process restarts. Private profile messaging remains in the `Conversation` and `Message` collections and must never be broadcast to the general room.
