# Ridge Cloud Media (optional)

Ridge Studio itself remains a static GitHub Pages app. This Worker is optional and adds cloud Pexels search/proxy, a strictly free-only AI-video adapter, and an optional NVIDIA NIM second-opinion editor.

## Why this exists

- Keep `PEXELS_API_KEY`, `HF_TOKEN`, and `NVIDIA_API_KEY` out of browser JavaScript.
- Cache Pexels search metadata for 24 hours.
- Range-stream one selected Pexels clip at a time to the canvas with CORS.
- Never copy the Pexels library into IndexedDB.
- Try short AI video clips only when the selected Hugging Face provider is explicitly reported as `is_free=true`.
- Let NVIDIA NIM review the already-locked Groq release package without making NVIDIA a hard dependency.
- If NVIDIA is unavailable or rate-limited, Ridge keeps the Groq/current version and continues.
- If no verified-free video provider exists, return HTTP 402 and let Ridge continue with Pexels/local/procedural scenes.

## NVIDIA secret sauce

The Worker reads `NVIDIA_API_KEY` only from a Cloudflare Worker secret. Do **not** put the key in `studio-v2.html`, `studio-v3.js`, `wrangler.toml`, a GitHub issue, or chat.

Default model: `sarvamai/sarvam-m` through NVIDIA NIM. The model name is a non-secret Worker variable (`NVIDIA_TEXT_MODEL`) so it can be changed later without changing the browser app.

Studio modes:

- **Off** — existing Groq/current pipeline only.
- **Shadow** — NVIDIA creates a second candidate but does not replace the release. This is the default for testing quality safely.
- **Prefer NVIDIA** — NVIDIA replaces only title/description/hashtags/tags/lyrics/intro/outro when the reviewer itself says its version is better with at least 78% confidence. The locked story/hook are never replaced.

## Deploy directly with Wrangler

```bash
cd cloud
npm install
npx wrangler login
npx wrangler secret put PEXELS_API_KEY
npx wrangler secret put HF_TOKEN        # optional
npx wrangler secret put NVIDIA_API_KEY  # optional NVIDIA NIM secret sauce
npm run deploy
```

When Wrangler asks for the NVIDIA secret, paste the key into that hidden terminal prompt — not into the repository.

## Deploy with GitHub Actions

The manual **Deploy Ridge Cloud** workflow also supports repository Actions secrets. Add these under **GitHub repository → Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `PEXELS_API_KEY`
- `HF_TOKEN` (optional)
- `NVIDIA_API_KEY` (optional)

Then run **Actions → Deploy Ridge Cloud → Run workflow**. The workflow forwards `NVIDIA_API_KEY` into Cloudflare using `wrangler secret put`; it is never written to the repository.

After deployment, paste only the public `https://...workers.dev` URL into **Settings → Ridge Cloud** in Studio.

`HF_TOKEN` is optional. The default `FREE_VIDEO_ONLY=true` refuses generation unless provider metadata explicitly marks the configured model free. Ridge does not intentionally fall through to paid inference.

The AI-video retry window (3/5/10 minutes) is a *wall-clock attempt budget*, not a promise that a free provider can generate a continuous 3–10 minute movie. Ridge uses successful short generated clips, Pexels stock, local media and procedural visuals as a scene pool, then beat-syncs that pool across the entire song.
