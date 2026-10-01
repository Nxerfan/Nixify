# Nixify Node.js SDK

A small, dependency-free Node.js SDK for the [Nixify](https://nixify.ir) email
OTP platform. Send, verify, and resend one-time passwords over the v1 REST API.

> **Availability — repository-only.** This SDK ships **inside the Nixify
> repository** at [`sdk/nodejs/`](.) and is **not published to npm**. The
> `package.json` is marked `"private": true`. To use it, copy this folder into
> your project or install it from a local path. There is no `npm install
> @nixify/nodejs` step — that package name is reserved by the repository but
> has no published release.

## Requirements

- Node.js 18+ (uses the built-in global `fetch`, `AbortController`, and
  `crypto.randomUUID`).
- A Nixify API key (`mg_live_*` for production, `mg_test_*` for sandbox).

## Install (local / repository)

Pick whichever fits your project:

### Option A — copy the folder

```bash
# From the Nixify repo root:
cp -R sdk/nodejs ./nixify-sdk
```

```js
// In your app:
const { Nixify, NixifyError } = require("./nixify-sdk");
```

### Option B — install from a local path

```bash
# package.json
{
  "dependencies": {
    "@nixify/nodejs": "file:../nixify/sdk/nodejs"
  }
}
```

```bash
npm install   # or: bun install / pnpm install
```

```js
const { Nixify, NixifyError } = require("@nixify/nodejs");
```

> Because the package is `"private": true`, it will not be published if you run
> `npm publish` from within the folder — that is intentional.

## Quick start

```js
const { Nixify, NixifyError } = require("./nixify-sdk");

const nixify = new Nixify(process.env.NIXIFY_API_KEY);

// Send an OTP (sandbox keys return the code in the response):
const { otp_request_id, expires_at, code } = await nixify.otp.send({
  email: "user@example.com",
  purpose: "signup", // optional, defaults to "signup"
});

// Verify the code the user entered:
const { verified } = await nixify.otp.verify({
  email: "user@example.com",
  code: "123456",
});

// Resend (purpose is required for resend):
await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });
```

## Public contract

The SDK exports **named CommonJS exports only** — `Nixify` and `NixifyError`.
There is **no default export**. This keeps the CJS runtime, Node ESM interop,
and the TypeScript declarations (`index.d.ts`) describing the exact same shape.

```js
// Correct:
const { Nixify, NixifyError } = require("./nixify-sdk");

// There is NO default export — the following will NOT work:
// const Nixify = require("./nixify-sdk").default; // undefined
```

TypeScript:

```ts
import { Nixify, NixifyError } from "./nixify-sdk";
```

## Retry semantics (conservative)

The Nixify OTP API does **not** implement server-side deduplication for an
`Idempotency-Key` header on `/api/v1/otp/send` or `/api/v1/otp/resend`.
Therefore this SDK does **not** send an `Idempotency-Key` header and treats OTP
mutations as **non-idempotent**: ambiguous failures are never retried
automatically.

| Outcome                     | Retried? | Behavior                                   |
| --------------------------- | -------- | ------------------------------------------ |
| `429 Too Many Requests`     | Yes      | Honors `Retry-After` (then backoff).       |
| `4xx` (except 429)          | No       | Throws `NixifyError` immediately.          |
| `5xx`                       | No       | Throws `NixifyError` immediately.          |
| Network error               | No       | Throws `NixifyError` (`code: "network_error"`). |
| Timeout                     | No       | Throws `NixifyError` (`code: "timeout"`).   |

`otp.verify()` **fails closed** on any ambiguous failure (5xx, network error,
timeout): it throws a `NixifyError` rather than silently resolving to a
not-verified result, because an unknown server state must never be treated as a
legitimate verification failure.

`maxRetries` (default `2`) applies **only** to `429` responses.

## Errors

Every non-2xx response (and every network/timeout failure) throws a
`NixifyError` with:

| Property     | Description                                                |
| ------------ | --------------------------------------------------------- |
| `code`       | Machine-readable error code from the API (`error.code`).   |
| `status`     | HTTP status code (`0` for network/timeout errors).         |
| `requestId`  | The `X-Request-Id` / `request_id` from the response.        |
| `docUrl`     | Doc URL for the error code, if the API provided one.        |

The API key is **never** included in the error object, its properties, or log
entries.

```js
try {
  await nixify.otp.send({ email: "user@example.com" });
} catch (err) {
  if (err.code === "rate_limited") {
    // 429 — the SDK already retried per maxRetries; surface to the caller.
  }
}
```

## Options

| Option       | Type                          | Default             | Description                       |
| ------------ | ----------------------------- | ------------------- | --------------------------------- |
| `baseUrl`    | `string`                      | `https://nixify.ir` | API base URL.                     |
| `timeout`    | `number`                      | `30000`             | Per-request timeout in ms.        |
| `maxRetries` | `number`                      | `2`                 | Retries on HTTP 429 only.         |
| `logger`     | `function` or `{info\|log\|debug}` | noop               | Receives a `LogEntry` per request. |

## Raw REST

You do not need this SDK — the API is plain REST. See the public docs at
[/docs](https://nixify.ir/docs) for `curl` and `fetch` examples. This SDK is a
thin convenience layer over the same endpoints.

## Tests

```bash
# From the Nixify repo root:
bun run test:sdk
```

## License

MIT.
