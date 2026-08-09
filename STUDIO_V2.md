# Ridge Studio V2

`studio-v2.html` is an additive GitHub Pages music-video studio. It does not require Firestore, Firebase, a server, npm, or a build step.

## What it adds

- 12 reusable music/visual templates.
- 10 audio-reactive visualisers: Spectrum, Radial, Wave, Orbit, Ribbon, Tunnel, Particles, Mountain, Kaleido and Rain.
- Multi-image scene backgrounds with slow motion and crossfades.
- Real-time browser rendering to WebM with the track embedded as audio.
- Poster-frame JPEG export.
- Google OAuth and direct resumable YouTube upload, with optional custom-thumbnail upload.
- Suno handoff: build/copy a music prompt, open Suno, then drop the downloaded audio back into Ridge.
- ChatGPT and Claude handoff buttons that copy a detailed packaging prompt and open the selected assistant, without storing either provider's secret API key in the page.

## Install

Copy these files into the repository root:

- `studio-v2.html`
- `studio-v2.css`
- `studio-v2.js`
- `AGENTS.md`
- `CLAUDE.md`

Copy `.github/workflows/static-checks.yml` into the same path in the repository.

Because the repo is already a static GitHub Pages site, the V2 studio will be available at:

`https://coolcryptomaniac.github.io/YoutubeNewProject/studio-v2.html`

If the Pages site uses a custom domain, use `/studio-v2.html` on that domain instead.

## YouTube setup

Use the same Google OAuth Web Client ID as the existing app. The authorized JavaScript origin must include the GitHub Pages origin. The V2 page stores only the client ID in localStorage; the short-lived OAuth access token is held in memory and disappears on refresh.

## Browser notes

Chrome/Edge are the preferred browsers because the workflow depends on `MediaRecorder`, `canvas.captureStream()`, Web Audio and Google Identity Services. Rendering is real-time: a four-minute song takes about four minutes to render and the tab should remain visible.

## Suno

Do not paste Suno cookies or session tokens into this project and do not depend on unofficial reverse-engineered endpoints. V2 intentionally treats Suno as a handoff: prompt -> Suno website -> downloaded audio -> Ridge.
