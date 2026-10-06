# Homepage hospital assistant

The homepage bottom navigation has an AI assistant button beside Live chat. Only one chat panel opens at a time. The assistant uses the existing client theme and EN/KR/UZ preference. It calls `askHospitalAssistant(input: AskHospitalAssistantInput!)` through Apollo. The global ValidationPipe trims and validates a 1–1000 character question and the existing language enum.

## Current scope

This is public website assistance for guests and members, not access to private profiles or staff workspaces. `AiChatService` calls the existing public `getServices` and `getDoctors` services (first page, 20 each) and projects only service name/type/price/duration and doctor display name/specialty/experience. Full documents, contact fields, tokens and clinical data are not sent. The catalog is a bounded sample, not a complete search. The prompt instructs the assistant to avoid inventing facts or acting on bookings and to refer medical advice to a clinician. Responses are plain text; page shortcuts are fixed application routes.

Each question is independent. The panel keeps the last 40 displayed messages only in component memory; no database conversation history, no clinical context, no tool calls and no WebSocket broadcast. Closing/reopening keeps the current panel state; leaving the layout/reloading clears it. Provider errors retain the draft. This stage does not complete the full planned AI integration (owned persisted conversations, catalog search tools and live provider verification remain).

## Configuration

Gemini generation is disabled unless `AI_CHAT_ENABLED=true`. Check the key's Google AI Studio project tier before enabling; setting this flag cannot enforce Free Tier on a paid Google project. No generation is made during tariff verification.

For Gemini free tier, set `AI_CHAT_PROVIDER=gemini`, `AI_CHAT_MODEL=gemini-2.5-flash` and a Google AI Studio API key. Gemini uses its native `generateContent` endpoint and the `x-goog-api-key` header, with 600 output tokens and disabled thinking for 2.5 Flash. Free tier quota and billing are controlled by the Google project; the application never falls back to a paid provider. OpenAI remains available with `AI_CHAT_PROVIDER=openai` (legacy default when omitted). A model must be an identifier, never a URL.

For OpenAI, set **backend-only** `AI_CHAT_API_KEY` and `AI_CHAT_MODEL` in the backend `.env`, using an OpenAI model available to your API account that supports Chat Completions. Neither has a default. Restart the API after configuration. Never use `NEXT_PUBLIC_` for the key or commit `.env`. The provider uses the existing Nest Axios HttpService, `https://api.openai.com/v1/chat/completions`, 20 second timeout, no redirects, 600 output tokens and `store: false`.

API contract: `READY` with `text`, or `NOT_CONFIGURED`, `UNAVAILABLE`, `RATE_LIMITED` without provider details. Requests and responses for this resolver are omitted from the normal GraphQL body logs. Provider exceptions are logged as a generic warning.

Limits are local to one API process: 6 requests per request IP per minute, 60 total per minute, 4 concurrent requests. The IP comes from Express/socket, not a client-supplied identifier. IP entries are hashed and expired during admission; behind a proxy configure Express trust settings deliberately. Multiple API processes require a shared rate limiter before public deployment.

## Verification

Unit tests cover DTO validation, public projections, disabled configuration, safe provider failures, per-address limits and concurrent admission; transport tests cover server authorization, bounded request configuration, empty output and transport failure. No paid provider call is made by these tests.

Provider contract reference: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
