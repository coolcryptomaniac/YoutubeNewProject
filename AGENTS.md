# Ridge AI contributor guide

This repository is intentionally a static, browser-first YouTube creation studio deployed with GitHub Pages. Keep it that way unless the owner explicitly asks for a backend.

## Architecture constraints

- No Firestore/database by default. Persist browser state with `localStorage` and IndexedDB (`core.js` vault).
- No build step is required for production pages. Prefer plain HTML/CSS/ES modules.
- Never commit API secrets, OAuth access tokens, refresh tokens, cookies, Suno session data, or service-account credentials.
- Keep existing `music.html`, `shorts.html`, `index.html`, `core.js`, `genres.js`, `visuals.js`, and `lyrics.js` backward-compatible.
- New experiments should be additive (for example `studio-v2.html` or `lab.html`) until proven.

## AI collaboration

Both ChatGPT/Codex and Claude Code may work on this repo. Before editing:

1. Read `README.md`, `SETUP.md`, this file, and `CLAUDE.md`.
2. Inspect current behavior before replacing it.
3. Preserve work produced by the other assistant unless a change is clearly required.
4. Prefer one feature branch/PR per task and state which files were changed.
5. Never let two assistants rewrite the same large file concurrently; merge one PR first, then rebase the next.
6. Do not invent platform APIs. If a service does not expose an official supported API, use an explicit handoff workflow instead of scraping private endpoints.

## Product priorities

1. Reliable music-video generation in the browser.
2. More distinctive audio-reactive visualisers and reusable templates.
3. Strong metadata/thumbnail/scene-assist workflows.
4. Resumable, user-authorized YouTube upload.
5. Smooth handoff to music generators such as Suno when no official API exists.
6. Mobile-safe controls and crash-resistant local persistence.

## Security rules

- Do not ship OpenAI or Anthropic secret API keys in GitHub Pages client code.
- Prefer ChatGPT/Codex and Claude Code for repository work rather than embedding long-lived provider keys in a public static app.
- Google OAuth client IDs are public identifiers; OAuth access tokens are not and should remain in memory only.
- If a future hosted AI gateway is added, keep it optional so the static app continues to work without it.

## Validation

For HTML/JS changes, at minimum check syntax, missing element IDs, browser feature fallbacks, upload error handling, and that rendering/upload failures are surfaced to the user rather than silently swallowed.
