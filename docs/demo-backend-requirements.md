# Demo backend: required API surface and proxy design

Date: 2026-10-30  
Status: implementation requirements; backend changes not implemented here

Frontend update (2026-11-11): landing-card onboarding now offers personal OpenRouter credentials or
an explicitly experimental demo profile with a generated placeholder key. Decisions now supply the
per-operation server override described below. Backend availability, limits, and API compatibility
remain unverified; demo selection does not constitute verification.

Frontend limits are now implemented across all four tools: demo allows 5 configured tasks,
2 calls per task, 64 KiB text/JSON and 5 MiB total serialized request input including encoded images.
Loaded records are checked before running. Non-demo runs request cost confirmation above 5 active
tasks, 5 calls per task, 32 KiB text/JSON or 2 MiB total per request. These are browser-side guardrails,
not server enforcement; direct API clients can bypass them. Backend quotas and request validation
remain required independently.

Demo chat and extraction now send a maximum of 2,048 output tokens per request through the SDK
adapter, including when the chat field is blank or a loaded record requests more. Smaller limits
are preserved. Enforce this ceiling server-side as well. The installed SDK exposes no equivalent
token parameter for the Decisions or dedicated Images endpoints; use their operation-specific
quotas and supported request controls instead. Large extraction results may be truncated by the cap.

## Recommendation

**Use a small, restricted OpenRouter proxy with explicit route mappings.** Most request and response bodies can pass through in OpenRouter's wire format. There is no need to implement separate LLM business logic for every frontend tool, nor to proxy every OpenRouter endpoint.

The proxy still needs server-side model restrictions, rate/quota enforcement, request limits, and owner-key injection. Exposing an unrestricted forwarding endpoint would let anyone spend the owner's credits on operations the demo never intended to offer. A random client key is a compatibility placeholder, not authentication or an abuse-control identity.

## 1. Known state and scope

- Demo API base URL: `https://g1.lt/home/api/v1/ai-test/`.
- Owner reports that the backend currently has only `/agent/submit`. Its implementation, method, request shape, and response shape have not been provided or verified.
- The demo was previously reported as not working yet. This document does not claim it is live.
- Intended authentication: any random client key is accepted; the backend uses the owner's real OpenRouter key upstream.
- This repository contains the frontend, not the backend implementation.
- The frontend currently uses `@openrouter/sdk`; it does **not** call `/agent/submit`.
- The installed SDK inspected for this document is **1.4.14**. `package.json` declares `^1.3.8`; check the resolved version when implementing or upgrading.

The following route paths were verified using a fake SDK HTTP transport that printed outgoing URLs and returned local errors. No request was sent to the demo or OpenRouter, and no paid generation was performed.

## 2. Routes needed by the current frontend

Let **B** mean `https://g1.lt/home/api/v1/ai-test/`. Incoming paths below are appended to B; upstream paths are absolute paths on `https://openrouter.ai`.

| Incoming route | OpenRouter upstream | Frontend functionality | Priority |
| --- | --- | --- | --- |
| `POST B/chat/completions` | `POST /api/v1/chat/completions` | Single chat, chat batches, and schema-based image extraction | Required for chat/extraction |
| `GET B/models` | `GET /api/v1/models` | Chat and vision model suggestions and token-price labels; decisions currently also use chat suggestions | Required for complete model-selection UI |
| `POST B/images` | `POST /api/v1/images` | Image generation with optional references | Required for images |
| `GET B/images/models` | `GET /api/v1/images/models` | Image model choices, aspect ratios, resolutions, and input-image support | Required for complete image controls |
| `GET B/images/models/{author}/{slug}/endpoints` | `GET /api/v1/images/models/{author}/{slug}/endpoints` | Image price labels | Optional for generation; needed for price hints |
| `POST B/api/alpha/decisions` | `POST /api/alpha/decisions` | Typed decisions | Required for decisions, **after frontend routing fix below** |

This is six route patterns, with two modality queries sharing `/models`. It is not six independently implemented model clients: one forwarding component can serve them using a fixed routing table and per-operation policies.

OpenRouter documents the dedicated `/api/v1/images` generation route and image-model discovery, and its decisions API lives outside `/api/v1`, at `/api/alpha/decisions`. [Image API tutorial](https://openrouter.ai/blog/tutorials/image-generation/), [Decisions API reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request).

### Exact model-list requests observed

```text
GET B/models?limit=500&offset=0&output_modalities=text
GET B/models?input_modalities=image&limit=500&offset=0
```

Preserve supported modality/pagination query parameters. The SDK inserts pagination defaults. The current hooks read the returned page, so return the curated demo catalog on that page rather than leaving relevant models behind an inaccessible page. If forwarding paginated upstream catalogs, collect/filter them or implement consistent filtered pagination.

### Decisions: frontend routing fix implemented

In installed SDK 1.4.14, `alpha.decisions.create` chooses its operation-specific default server (`https://openrouter.ai`) unless a **per-call** `serverURL` is supplied. The frontend now supplies that override: the standard OpenRouter API base maps to `https://openrouter.ai`, while demo and custom profiles retain their configured base URL. A transport-level test verifies destinations and authorization headers without live requests.

Observed with the fake transport:

```text
Current call:       POST https://openrouter.ai/api/alpha/decisions
Per-call override: POST https://g1.lt/home/api/v1/ai-test/api/alpha/decisions
```

For a demo profile, pass its base URL through the operation options:

```ts
// Required per-operation override (now implemented in submitDecision).
await client.alpha.decisions.create(
  { decisionsRequest: { model, state, questions } },
  { serverURL: demoBaseURL },
);
```

The apparent repeated `api` in the resulting demo path is intentional: the SDK appends `api/alpha/decisions` to B. Map that exact local route to OpenRouter's `/api/alpha/decisions`. A prettier local `/decisions` path would require additional frontend URL rewriting; it is not necessary.

Do not blindly pass the standard OpenRouter profile base (`https://openrouter.ai/api/v1`) as this per-call override: that would produce the wrong `/api/v1/api/alpha/decisions` URL. Keep the canonical OpenRouter decisions origin as `https://openrouter.ai`, and explicitly resolve the operation base for demo/custom profiles. Add a transport-level routing test covering both profiles.

### What to do with `/agent/submit`

Keep it for existing backend clients if needed. Add `POST B/chat/completions` as an adapter/alias to its internal handler **only if** that handler can preserve the OpenRouter request and response contract. If `/agent/submit` returns a custom envelope or accepts a simplified prompt, add a compatibility adapter or forward the standard route directly.

Changing the frontend provider base to end in `/agent/submit` will not fix compatibility: the SDK appends its operation paths, such as `/chat/completions`.

## 3. Request and response contracts

Forward JSON in its HTTP wire shape, not the SDK's camelCase TypeScript shape. Preserve successful OpenRouter responses without wrapping them in an application-specific `{ success, result }` envelope. The SDK performs response validation and field-name conversion itself.

| Operation | Request fields the app needs | Response data used by the app |
| --- | --- | --- |
| Chat | `model`, `messages`, optional `tools`, `temperature`, `reasoning`, `max_tokens`; `stream: false` | Completion ID/model, `choices` with content/reasoning/tool calls, finish reason, usage |
| Extraction, same chat route | Multimodal `messages` containing text and `image_url` parts; `response_format` with strict `json_schema`; `stream: false` | JSON text in the first choice's content, usage |
| Images | `model`, `prompt`, `n: 1`, optional `input_references`, `aspect_ratio`, `resolution` | `data` with `b64_json` and media type, optional usage |
| Decisions | `model`, `state`, `questions` with `noul`, `choice`, or `score` definitions | Named `answers` and optional usage |
| Text/vision model catalog | Modality and pagination query parameters | Model IDs and pricing, plus remaining schema-required metadata |
| Image model catalog | No special application query required | IDs, architecture/input modalities, supported parameter descriptors |
| Image endpoint catalog | Validated author and slug path parameters | Endpoint pricing entries, including `output_image` billing units |

Do not return a reduced catalog with only an ID and display label unless it still satisfies the installed SDK's schema. Filter the upstream catalog entries while preserving their required fields. Missing price information can remain missing; do not invent zero-cost claims.

**Extraction requires no new extraction endpoint.** It is already implemented as a multimodal chat-completion request with structured output. The backend needs to allow those message and schema fields, and the demo model must support them. The model generates the JSON; the backend need not implement OCR or schema extraction itself.

**Image generation uses `/images`, not `/images/generations`, in this frontend's SDK.** Preserve base64 image responses; returning only a hosted URL would not match the current adapter. The dedicated API's documented wire response includes `data[].b64_json`. [OpenRouter image response example](https://openrouter.ai/blog/tutorials/image-generation/).

## 4. What the proxy should do

### Routing and credentials

1. Match an explicit method/path allowlist. Reject every other operation, including key management, credits/account administration, file upload, and arbitrary URLs.
2. Build the upstream URL from the fixed routing table. Validate dynamic model segments; reject traversal, encoded path tricks, and unsupported query parameters. Do not accept a client-supplied host or upstream URL.
3. Discard the incoming dummy `Authorization` value. Set `Authorization: Bearer <owner-secret>` server-side. Never forward arbitrary incoming cookies, credential headers, or client-chosen upstream authentication.
4. Store the real key only in server-side secret configuration. Never include it in API responses, browser assets, logs, or error text. Use a dedicated restricted owner key for the demo if available.
5. Forward accepted JSON fields and supported query parameters. Return upstream status/body in SDK-compatible form, with sanitized errors where necessary. Do not follow redirects to arbitrary hosts with the owner credential.

One handler can implement these steps for all allowed operations. No unrestricted wildcard fallback should exist behind it.

### Allowed models and optional paid features

Maintain an explicit model allowlist per operation. Intersect returned catalogs with these allowlists so users see models they can actually run. Validate the model again on every POST, since callers can bypass the UI.

Model IDs alone are not a complete spending policy. Reject or tightly control fields that can select fallback models, routers, presets, additional paid tools, or different upstream behavior. In particular, the chat editor can add `openrouter:web_search`; decide whether the demo supports its cost and limits. Ordinary function-tool definitions can remain available without running user functions on the backend.

The decisions table currently uses the text-model discovery hook. That is a frontend mismatch for a curated decisions demo: add decisions-specific discovery (`output_modalities=decisions`, if supported by the deployed API) or supply a dedicated curated list. Do not advertise arbitrary text models as decisions-compatible. Confirm actual model capability before enabling each tool.

### Quotas and resource limits

- Enforce per-IP short-window rate limits, longer-window request quotas, concurrent-request limits, and a global spend ceiling/kill switch.
- Use the hosting platform's trusted client-IP mechanism. Client-supplied forwarding headers and random dummy keys must not reset identity or quota.
- Reserve quota atomically before dispatch. Shared storage is required when multiple instances serve traffic. Specify whether failed attempts consume quota and avoid automatic refunds for ambiguous upstream timeouts that may already have incurred cost.
- Cap body size, decoded image size/count, schema/state/question size, output tokens, image `n`, resolution, and other expensive parameters server-side. The frontend's resampling and call-count controls are conveniences, not enforcement.
- The frontend offers batch-wide request-start spacing and concurrency of 1–5. Demo defaults to a 1-second interval and concurrency 1, with 5 tasks and 2 calls per task maximum. Personal-key mode defaults to no delay and concurrency 5, with 1–20 calls per task. These client controls are bypassable. Every upstream call must be accounted for; the backend does not need a separate batch endpoint. SDK-internal retries are unchanged and are not individually paced by the UI queue.
- Cache allowed model metadata and pricing with a bounded TTL. Discovery should not consume the same generation quota, but should have its own inexpensive rate limit. The image UI can fetch endpoint pricing once per listed model.

### Timeouts, retries, and errors

Extraction has a frontend timeout of 120 seconds; image generation has 180 seconds. Configure the backend and hosting gateway to support the chosen execution budget, and return useful JSON errors before the frontend times out. Chat/decisions also need explicit server execution limits.

The installed SDK retries some server/connection failures. Do not stack aggressive backend retries on top of that for paid POSTs. Cancellation or an uncertain timeout does not prove the upstream request was not billed. Choose a retry/idempotency policy and test it rather than assuming each click causes exactly one billable request.

Recommended local error format:

```json
{
  "error": {
    "code": 429,
    "message": "Demo request limit reached. Try again later."
  }
}
```

Use 400 for invalid payloads, 403 for disallowed models/features, 413 for oversized requests, 429 for quotas, and an appropriate unavailable/timeout status for upstream failures. Preserve useful HTTP status codes, supply `Retry-After` when meaningful, and avoid returning HTML gateway errors. Verify error parsing with the installed SDK.

### Browser access and data handling

Support CORS preflight for the frontend origin and allowed methods/headers, including `Authorization` and `Content-Type`. Include CORS headers on errors as well as successes; expose `Retry-After` via `Access-Control-Expose-Headers: Retry-After`. The frontend displays demo HTTP 402 (service spending limit) and 429 (per-IP quota or temporary service rate limit) errors with the server explanation, retry guidance from this header (seconds or HTTP-date), and instructions to use a personal OpenRouter key in Settings. Without an exposed header, it still displays the server explanation. Add SDK attribution headers only if the deployed frontend sends them. CORS does not authenticate callers or prevent non-browser abuse.

Do not log prompt/image bodies or authorization values by default. Define a retention policy for IP-derived quota state and operational logs. Demo prompts/images pass through this backend and OpenRouter; personal-key mode should continue calling OpenRouter directly.

## 5. Functionality that does not need backend endpoints

The frontend already handles:

- Record CRUD, search, and local persistence in PouchDB.
- Chat batch orchestration, run history, and UI progress.
- Response statistics and display formatting.
- Image input resizing and preview/zoom.
- Trusted JavaScript response tests in a Web Worker.
- Provider selection and local provider/API-key storage.

Optional CouchDB sync is separate infrastructure; it is not an OpenRouter proxy operation. Provider profiles and API keys are now excluded from that sync. Landing-page rendering and generating a dummy demo key are also frontend work.

Do not add backend execution of arbitrary JavaScript test suites, local record storage, accounts, or an OpenRouter batch API just to enable the current tools.

### Seeded demo requests and landing-page examples

**Requirement:** seed example requests for all four tools and list loadable examples directly on each landing-page tool card. Users should be able to load, inspect, edit, and run them. The [landing-page draft](__DRAFT__landing-page-and-demo.md#loadable-examples-on-each-card) defines the proposed example catalog and loading behavior.

Recommended ownership is frontend-only:

- Bundle a versioned example catalog and synthetic image assets with the app.
- Seed the corresponding local PouchDB record types idempotently, including on existing installations, without overwriting user edits.
- Render each card's Examples list from that same catalog.
- Load a fresh editable local copy without making a generation request or changing the active provider. Require explicit Submit/Start to run it.
- Keep examples loadable when the demo backend is unavailable. Use capability labels to distinguish inspection from currently supported execution.

**No additional backend endpoint is required to seed or load examples.** Running a loaded example uses the same proxy routes, model allowlists, and quotas as a handwritten request. An example ID must never bypass server limits. Reference-image and extraction examples submit their bundled image data through the existing image/chat payloads, so those payload sizes must fit the demo limits.

The initial catalog should cover basic chat, a function-call request, the existing fictitious prison prompt, typed decisions, text-to-image, image-to-image, receipt extraction, and contact-card extraction. Final prompts/assets and compatible allowed models must be verified before release. Do not seed fake model results as if a request has already run.

A remote `/examples` service is unnecessary for the initial implementation. It can be considered later only if examples must change independently of frontend releases.

## 6. Suggested implementation order

1. **Confirm `/agent/submit` contract.** Inspect the backend handler and identify reusable forwarding logic. Document current request/response schemas rather than assuming compatibility.
2. **Add standard chat compatibility and limits.** Implement `/chat/completions`, dummy-header replacement, fixed upstream, allowed models, quotas, and JSON error handling. Keep `/agent/submit` as a compatibility route if needed.
3. **Add filtered model discovery.** Serve `/models` with supported modality queries and complete SDK-compatible metadata. Verify suggestions and pricing.
4. **Enable extraction over chat.** Permit image content and strict JSON Schema; allow an extraction-capable model and test image/body limits. No separate route is needed.
5. **Add image support.** Implement `/images`, `/images/models`, and optionally model endpoint pricing. Validate image settings and output-size limits.
6. **Add decisions support and fix frontend routing.** Implement the explicit alpha path mapping, supply the per-call server override for demo, and provide compatible model suggestions. Preserve direct OpenRouter routing.
7. **Wire landing-page demo selection and examples.** Create/select a demo profile using B and a generated dummy key. Never reuse a visitor's real key. Seed the local example catalog and list loadable items on each card. Loading does not run a request or switch providers; enable execution only for supported capabilities.
8. **Verify deployed behavior before labeling demo available.** Test browser CORS, gateway timeouts, quota errors, allowed models, and network destinations.

## 7. Acceptance checks

| Check | Expected result |
| --- | --- |
| SDK with B and a random dummy key | All enabled operations reach the intended demo routes |
| Decisions in demo and personal-key modes | Demo uses B; direct mode uses `https://openrouter.ai/api/alpha/decisions` |
| Chat and tool-call response | Standard SDK parsing succeeds and the result panel displays content/tool calls |
| Schema extraction with an image | JSON text is returned through chat completions and parsed by the extraction page |
| Image generation with/without references | Current adapter can display the returned base64 image; unsupported settings fail clearly |
| Catalog and pricing calls | Only allowed models appear; metadata passes SDK validation |
| Arbitrary model, route, paid tool, or upstream URL | Rejected before any billable upstream call |
| Parallel callers and changed dummy keys | Per-IP/global quotas remain effective and atomic |
| Browser preflight and error responses | UI can read successful and failed requests without CORS masking |
| Timeout/retry/disconnect | No unbounded retries; uncertain billing handled according to the documented policy |
| Logs, responses, browser requests | Owner key is never exposed; demo never forwards a visitor key |
| Load example from any tool card | Correct inputs/assets open in a fresh editable local copy; no generation request or provider change occurs |
| Run a seeded example | Same model restrictions, quotas, and proxy routes apply as for user-authored requests |
| Repeat startup or load an example again | No duplicate startup seeds or overwritten user records; explicit loads produce independent working copies |
| Existing `/agent/submit` clients | Continue working if the compatibility route is retained |

Use a fake upstream for contract/quota tests. Run a small, explicitly budgeted live smoke test only after model IDs and deployment limits are chosen; no live tests were performed for this document.

## 8. Remaining backend inputs

- Source/contract of `/agent/submit` and its exact mounted URL/method.
- Hosting runtime, gateway timeouts, and shared quota-store choice.
- Allowed model IDs and supported operations for demo launch.
- Numeric rate, daily/window quota, concurrency, output/image, and spending limits.
- Whether web search is supported and how its usage is charged/limited.
- Allowed frontend origins and log/quota retention policy.

## Evidence

- [Frontend SDK adapter](../src/lib/openrouter-client.ts): operations and field mappings.
- [Chat model discovery](../src/hooks/use-chat-models.ts), [vision discovery](../src/hooks/use-vision-models.ts), [image discovery/pricing](../src/hooks/use-image-models.ts): automatic metadata calls.
- [Installed SDK dependency declaration](../package.json) and [lockfile](../yarn.lock).
- Installed SDK files inspected: `esm/funcs/chatSend.js`, `modelsList.js`, `imagesGenerate.js`, `imagesListModels.js`, `imagesListModelEndpoints.js`, `alphaDecisionsCreate.js`, and `esm/lib/sdks.js` beneath `node_modules/@openrouter/sdk`.
- Official OpenRouter references are linked next to the external API claims above. The exact frontend URL behavior was additionally checked with a local fake HTTP transport against installed SDK 1.4.14.
