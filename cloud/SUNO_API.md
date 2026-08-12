# Official Suno API integration

Ridge now has a server-side adapter for Suno's official developer platform.

## Current state

Suno publicly advertises a REST API at its developer platform, but the public login page does not expose the authenticated endpoint reference. Ridge therefore keeps the integration disabled unless explicit Worker secrets are configured and keeps the existing manual Suno handoff as the safe fallback.

No unofficial Suno wrapper, browser automation, cookie replay, captcha solving, or account-credit pooling is used.

## Ridge contract

Browser code calls only Ridge Worker endpoints:

- `GET /api/suno/capabilities`
- `POST /api/suno/generate`
- `GET /api/suno/status?id=<generation-id>`
- `POST /api/suno/cancel`

The Worker normalizes the upstream API into:

```json
{
  "provider": "suno-official",
  "id": "generation-id",
  "state": "queued|running|completed|failed|cancelled",
  "outputs": [
    {
      "id": "song-id",
      "title": "Song title",
      "audioUrl": "https://...",
      "imageUrl": "https://...",
      "duration": 180
    }
  ],
  "error": null,
  "rawStatus": "processing"
}
```

## Activation after Suno approval

Set these Cloudflare Worker secrets/variables only after the authenticated Suno Platform shows the official values:

```text
SUNO_API_KEY=<official credential>
SUNO_API_BASE=<official base URL>
```

Optional path overrides let Ridge adapt without application-code changes:

```text
SUNO_GENERATE_PATH=/v1/generations
SUNO_STATUS_PATH=/v1/generations/{id}
SUNO_CANCEL_PATH=/v1/generations/{id}/cancel
SUNO_AUTH_HEADER=Authorization
SUNO_AUTH_SCHEME=Bearer
```

The path and auth defaults are placeholders in the adapter, not a claim that Suno uses those exact production values. Replace them with the authenticated official documentation before enabling production traffic.

## Safety / quota behavior

- Credentials remain in the Worker; they are never stored in the GitHub Pages browser app.
- If credentials are absent, `/api/suno/capabilities` reports `mode: manual` and generation endpoints return `SUNO_NOT_CONFIGURED`.
- Rate limits are surfaced as `SUNO_RATE_LIMIT` with `retryable: true` instead of silently falling back to a paid third party.
- Ridge does not automatically route to unofficial providers if Suno fails.
- The browser client supports cancellation and bounded polling rather than infinite requests.

## Files

- `cloud/src/providers/suno.js` — official provider adapter and response normalization.
- `cloud/src/worker.js` — Ridge gateway routes.
- `suno-api.js` — browser-safe client with automatic manual/API capability selection.
