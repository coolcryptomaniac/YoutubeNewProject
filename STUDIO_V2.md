# Ridge Studio V2

`studio-v2.html` is the separate, browser-first one-click music-video workflow. It remains independent from the Claude-built `music.html` studio.

## V2.1 memory architecture

V2.1 does not try to “increase the JavaScript heap”; browsers control that limit. It avoids exhausting it instead:

- Uploaded images are decoded **one at a time**, resized/compressed, written to IndexedDB, and the original decoded bitmap is released immediately.
- The renderer keeps at most **three decoded images** and **two video elements** hot at once.
- Uploaded and generated video scenes stay as blobs in IndexedDB and are only decoded when they are the current/next scene.
- Audio is not kept decoded while you edit. It is decoded only for the final render and released when rendering finishes.
- On Chromium, final MediaRecorder chunks stream to **Origin Private File System (OPFS)**. The finished `File` is disk-backed, so a long render no longer requires a same-sized array of video chunks in RAM.
- `navigator.storage.estimate()` is shown in the UI, and V2 requests persistent origin storage where the browser allows it.

## One-click workflow

The **ONE CLICK → CREATE + PUBLISH** button can:

1. Create the AI release package (song prompt, title, description, tags, thumbnail direction and scene prompts).
2. Generate a song if no audio is loaded.
3. Generate scene images.
4. Optionally generate two real AI video clips.
5. Generate a 1280×720 thumbnail with a readable headline.
6. Render the full audio-reactive WebM.
7. Upload the video and thumbnail to YouTube when OAuth is connected.

You can still run every stage manually.

## AI engine

V2.1 uses Pollinations as the optional unified generation provider because it supports browser-safe **publishable keys (`pk_…`)** and exposes text, image, video and music generation from one API. Keep secret `sk_…` keys out of GitHub Pages.

V2 exposes selectable text routing (OpenAI / Claude / Gemini / DeepSeek through Pollinations), image models, video models, and music models including ElevenMusic and Stable Audio. Generation consumes whatever credits/budget are attached to your Pollinations account/key; it is not assumed to be unlimited or free.

Without a Pollinations key:

- your own uploaded audio works;
- anonymous Pollinations image generation is attempted as a fallback;
- metadata has a deterministic fallback;
- automatic music and video generation are disabled.

## Suno

Suno remains an assisted handoff. V2 copies the generated music prompt and opens Suno. A static GitHub Pages app cannot safely fill or operate a logged-in Suno page because of browser same-origin isolation, and V2 deliberately does not scrape private endpoints, copy session cookies, or embed Suno account credentials.

If you want a fully automatic song in the one-click pipeline, choose one of the supported music generators in **AI Engine** instead.

## YouTube

Use the same Google OAuth Web Client ID as the existing project. V2 requests only the YouTube upload scope. Privacy defaults to **Private**. OAuth access tokens are held in memory and disappear on refresh.

## Rendering notes

- Chrome/Edge are preferred for OPFS, MediaRecorder, Canvas capture and Web Audio.
- Rendering is real time so a three-minute song takes about three minutes.
- `Auto safe` chooses 720p on lower-memory devices and 1080p on devices reporting at least ~6 GB via `navigator.deviceMemory`.
- 60 fps is available but 30 fps is the recommended default for mobile stability.
