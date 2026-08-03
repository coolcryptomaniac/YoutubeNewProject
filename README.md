# Ridge

Three screens for running a YouTube channel from a browser. No server, no build step,
no install — static files on GitHub Pages, plus one nightly job that prepares your work
while you sleep.

**Start with [SETUP.md](SETUP.md).** Five minutes gets it online.

| | |
|---|---|
| **`index.html`** | **Today** — your numbers, what they suggest, and tomorrow's clips already written and drawn |
| **`shorts.html`** | **Shorts studio** — 9:16 Hindi comedy, ~10s, consistent characters |
| **`music.html`** | **Music video studio** — Suno tracks into audio-reactive videos |
| **`.github/workflows/brief.yml`** | the nightly job that fills the Today screen |
| **`config.json`** | your cast, tone and how many clips a day |

## How autonomous is it, really

Every morning around 8:00 IST, without you doing anything, GitHub runs a job that:

1. reads your channel's last 30 uploads and their view, like and comment counts
2. works out what's actually performing — Shorts against long-form, which tags travel,
   whether upload gaps line up with the weak ones
3. asks a language model what that means and what to do about it, with instructions to
   name specifics and to be willing to say *stop doing this*
4. writes three Hindi sketches for tomorrow, informed by what worked
5. draws all nine panels and commits them
6. writes `data/brief.json`, which your site reads

You open the site to a finished brief. What's left for you is filming — ten seconds a
clip, in your own voice if you want it — and pressing publish. Roughly fifteen minutes.

**What can't be automated, and why.** Rendering needs a browser canvas, so it happens on
your machine, not on a server. Uploading needs your live consent through Google sign-in.
Suno, Google Flow and Instagram each block programmatic access in ways no amount of code
gets around — the details are further down. Anyone promising you a fully hands-off
pipeline on these platforms is selling something that breaks within a month.

---

## Put it online

1. Create a public repo — e.g. `ridge`.
2. Upload every file, keeping the folder structure.
3. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**
4. Live at `https://YOURNAME.github.io/ridge/` in about a minute.

No workflow file. It's a static page.

## Two keys, both free

### YouTube — Google Cloud OAuth client

1. [console.cloud.google.com](https://console.cloud.google.com) → new project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **OAuth consent screen** → External. Add your own Google account under **Test users**
   (without this, sign-in is blocked). Add the scope `.../auth/youtube.upload`.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   **Authorized JavaScript origins** → `https://YOURNAME.github.io`
   (origin only — no path, no trailing slash)
5. Paste the client ID into **Setup**.

OAuth client IDs are public by design. The consent screen is what protects your account.

### Writing — Groq

[console.groq.com](https://console.groq.com) → API Keys → create one. No card required.
Paste it into **Setup**.

Default model is `openai/gpt-oss-120b`. Groq deprecated the Llama 3.x models in June 2026,
so the dropdown only offers current ones.

Scene art and thumbnails come from **Pollinations** — free, no key, no account.

## Daily flow

1. Generate songs in Suno, download the MP3s.
2. Drop them into **Tracks**.
3. **Assist → Write for all tracks.** You get a title, description, hashtags, a thumbnail
   headline and a scene prompt per track. All editable.
4. **Look → Generate scenes.** AI backdrops that pan and cross-fade through the song.
5. **Assist → Build for all.** Thumbnails composed from the scene art and the headline.
6. **Look → Render all queued.**
7. **Publish → Connect YouTube → Publish all rendered.**

## Things that will bite you

**Rendering is real time.** The browser records the canvas as it plays, so a 3-minute song
takes 3 minutes. Six songs is roughly 20 minutes with the tab open and *visible* —
background tabs get throttled and the recording stalls.

**Six uploads a day, hard ceiling.** Each Cloud project gets 10,000 quota units per day;
`videos.insert` costs 1,600 and `thumbnails.set` costs 50. The header tracks it. Resets at
midnight Pacific — 12:30 PM IST.

**Your uploads will land as private.** YouTube restricts videos uploaded through un-audited
API projects to private viewing. Either apply for an API compliance audit in the Cloud
Console, or flip each video to public in YouTube Studio afterwards. The second takes ten
seconds and is what most people do.

**Custom thumbnails need a phone-verified channel.** If yours isn't, the video still
uploads and only the thumbnail call fails. You'll see it in the activity log.

**Scene art is rate-limited.** Anonymous Pollinations allows roughly one image every 15
seconds, so three scenes takes about 45 seconds. The app paces itself automatically.

**Your Groq key lives in this browser's localStorage.** It goes only to Groq, but anyone
with access to the device can read it. Use a key you're willing to rotate.

**Chrome or Edge.** Firefox and Safari have patchier `MediaRecorder` support for the
canvas + audio combination.

**Output is WebM** (VP9 + Opus). YouTube accepts it natively.

## A word on volume

Six auto-generated uploads a day is the pattern YouTube's spam and repetitive-content
policies are written for, and channels have been demonetised for less. Two or three good
ones will almost certainly outperform six filler tracks. The tool doesn't stop you — just
know the risk is real.

---

# Ridge Shorts (`shorts.html`)

A companion app in the same repo for 9:16 vertical comedy clips with Hindi dialogue.
Deploys the same way — it's another static file. The two apps share your saved keys, so
set them once in either.

## What it does

**Cast** — pick a preset (dog & cat, street pups, cartoon kids), lock a description and a
seed. That exact wording plus that seed goes into every panel of every clip, which is what
keeps the characters recognisable from one day to the next.

**Script** — Groq writes 1–3 clips. Each is three beats: setup, escalation, punchline, with
one short spoken Hindi line in Devanagari per beat, plus an English visual prompt for the
panel and a Hinglish caption with hashtags.

**Take** — generates the three panels at 1080×1920, then films 8–15 seconds: slow push-in
on each panel, cuts on the dialogue beats, Hindi captions burned in with a stroke outline so
they read on any background. You can talk over it live through your microphone, drop in an
audio bed, or film silent.

**Publish** — straight to YouTube. A 9:16 video under 60 seconds is filed as a Short
automatically; no special flag exists or is needed.

## What it deliberately does not do

**Google Flow.** Your free 50 daily credits only work inside Flow's own web interface. There
is no public Flow API, and Google bills Flow credits and API usage as separate systems, so
the credits cannot be spent programmatically at all. The Gemini and Vertex routes to Veo do
have an API, but video generation there is paid per second with no free tier. Third-party
bridges that log into Flow on your behalf exist, charge a monthly fee, and break whenever
Google changes the page. None of that belongs in a tool you rely on daily.

So the panels come from Pollinations instead — free, no key — and the app animates the
stills rather than generating footage. It's a comic strip that moves. For ten seconds of
comedy, that reads better than you'd expect, and it never fails because someone else's
credits ran out.

If you want real Veo motion, make those clips by hand in Flow with your free credits and
post them from your phone. This app won't get in the way.

**Instagram auto-posting.** Instagram's publishing API doesn't accept a file upload — it
takes a public URL and fetches the video itself, in MP4 with H.264 video and AAC audio. A
static page has nowhere to host that, and the browser records WebM. On top of that it wants
a Business account, a linked Facebook Page, a Meta developer app, and approved
`instagram_content_publish` permission, which is a two-to-four week review.

The **Publish** tab gives you a download button and a copy-all-captions button instead.
Download, post from your phone, paste the caption. Under a minute for three clips.

## Notes that will save you time

**Character consistency is close, not exact.** Image models redraw from scratch each time.
A fixed cast sheet and a fixed seed hold the breed, colours, proportions and style steady.
Treat it like a hand-drawn comic strip, not a rendered 3D character.

**Panel generation is slow by design.** Anonymous Pollinations allows roughly one image
every 15 seconds, so three panels takes about 45 seconds. Failed requests retry twice with
backoff. If a panel still doesn't arrive, the clip films anyway and reuses the previous
panel for that beat.

**Record your own voice.** Shorts that play silent get buried, and generated-caption clips
all sound the same because none of them make a sound. Your Hindi voice over a ten-second
clip is the cheapest thing that separates this from every other AI channel.

**Two or three clips a day.** Past that, Shorts starts reading the channel as a content
farm, and that judgement is applied at the channel level — it would drag your music uploads
down with it.

**About the cartoon kids preset.** Photoreal AI children attract heavy platform scrutiny,
and anything YouTube reads as children's content gets flagged Made for Kids, which switches
off comments, notifications and most monetisation. That preset is locked to a clearly
cartoon style for exactly that reason. The animal casts avoid the issue completely and
tend to travel further anyway.
