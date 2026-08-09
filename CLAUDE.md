# Claude Code instructions for Ridge

Read `AGENTS.md` first. It is the shared contract for Claude Code and ChatGPT/Codex.

## Working style

- Treat the current repository as working software, not a blank-slate rewrite.
- Prefer additive modules and small patches over replacing large HTML files.
- Before touching `music.html`, search for an existing implementation in `core.js`, `genres.js`, `visuals.js`, and `lyrics.js`.
- Keep the project deployable as static GitHub Pages with no database by default.
- Do not add Firestore just for settings, queues, metadata, or render state; use browser storage unless cross-device sync becomes an explicit requirement.
- Never automate Suno by copying private endpoints, cookies, session tokens, or reverse-engineered browser calls. The supported path is a prompt/download handoff until an official public API exists.
- Never place provider secrets in committed JS. If a future feature requires server-held secrets, propose it as an optional backend rather than silently changing the architecture.

## Coordination with ChatGPT/Codex

When another assistant has already added a feature, preserve its public interfaces where practical. If you disagree with an implementation, explain the concrete bug or tradeoff in the PR rather than replacing it wholesale. Use separate branches and avoid concurrent edits to the same large file.

## V2 experiment

`studio-v2.html` / `studio-v2.js` / `studio-v2.css` are an additive next-generation music-video workflow. They are intentionally independent of the existing production studio so features can be tested before being folded into `music.html`.
