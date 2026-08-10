# Ridge Cloud Media (optional)

Ridge Studio itself remains a static GitHub Pages app. This Worker is optional and only adds cloud Pexels search/proxy plus a strictly free-only AI-video adapter.

## Why this exists

- Keep `PEXELS_API_KEY` and `HF_TOKEN` out of browser JavaScript.
- Cache Pexels search metadata for 24 hours.
- Range-stream one selected Pexels clip at a time to the canvas with CORS.
- Never copy the Pexels library into IndexedDB.
- Try short AI video clips only when the selected Hugging Face provider is explicitly reported as `is_free=true`.
- If no verified-free video provider exists, return HTTP 402 and let Ridge continue with Pexels/local/procedural scenes.

## Deploy

```bash
cd cloud
npm install
npx wrangler login
npx wrangler secret put PEXELS_API_KEY
npx wrangler secret put HF_TOKEN   # optional
npm run deploy
```

Then paste the deployed `https://...workers.dev` URL into **Settings → Ridge Cloud** in Studio.

`HF_TOKEN` is optional. The default `FREE_VIDEO_ONLY=true` refuses generation unless provider metadata explicitly marks the configured model free. Ridge does not intentionally fall through to paid inference.

The AI-video retry window (3/5/10 minutes) is a *wall-clock attempt budget*, not a promise that a free provider can generate a continuous 3–10 minute movie. Ridge uses successful short generated clips, Pexels stock, local media and procedural visuals as a scene pool, then beat-syncs that pool across the entire song.
