# Setup

Three stages. Stage 1 takes five minutes and gets you a working studio.
Stages 2 and 3 are what make it run itself. You can stop after any of them.

---

## Stage 1 — Get it online (5 minutes)

1. Go to **github.com/new**. Name the repo `ridge`. Make it **Public**. Create.
2. On the empty repo page click **uploading an existing file**.
3. Drag in everything from the zip — keep the folders as they are.

   > **Watch out for the hidden folder.** The zip contains `.github/workflows/brief.yml`,
   > and folders starting with a dot are invisible by default. If you don't upload it,
   > the nightly job never exists and Stage 3 silently does nothing.
   >
   > - **Mac:** in Finder press `Cmd + Shift + .` to show hidden files, then drag.
   > - **Windows:** in Explorer, **View → Show → Hidden items**, then drag.
   > - **Or skip the drag entirely:** after uploading the rest, click **Add file →
   >   Create new file**, type `.github/workflows/brief.yml` as the name (GitHub turns
   >   the slashes into folders as you type), paste in the contents of that file from
   >   the zip, and commit.
   >
   > To check it worked: your repo should show a **`.github`** folder, and the
   > **Actions** tab should list **Nightly brief**.

4. Scroll down, click **Commit changes**.
5. Go to **Settings → Pages**. Under *Source* pick **Deploy from a branch**,
   branch **main**, folder **/ (root)**. Save.
6. Wait a minute, then open `https://YOURNAME.github.io/ridge/`

You now have all three screens. The studios work; the dashboard will say there's no
brief yet. That's expected.

---

## Stage 2 — Connect YouTube (10 minutes, once)

You need a Google Cloud project so the apps can upload on your behalf.

1. Open **console.cloud.google.com** → **Select a project** → **New project**.
   Call it `ridge`. Create.
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create
   - Fill in app name and your email, Save and continue
   - **Scopes** → Add or remove scopes → paste these three, one per line:
     ```
     https://www.googleapis.com/auth/youtube.upload
     https://www.googleapis.com/auth/youtube.readonly
     https://www.googleapis.com/auth/drive.file
     ```
     Update → Save. Declaring all three here is fine — they only clash when
     *requested together*, which the app avoids. See below.
   - **Test users** → **Add users** → add your own Gmail address.
     *Skip this and sign-in will be blocked.* Save.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** → Add → `https://YOURNAME.github.io`
     (origin only — no `/ridge`, no trailing slash)
   - **Authorized redirect URIs** → Add → `https://developers.google.com/oauthplayground`
     (you need this in Stage 3; add it now while you're here)
   - Create. Copy the **Client ID** and the **Client secret**. Keep the tab open.
5. Open your site → **Shorts → Setup** → paste the Client ID → **Save**.
6. **Publish** → **Connect YouTube**. Google will warn you the app isn't verified —
   click **Advanced → Go to (your app)**. That warning is because it's your own
   unpublished app, which is exactly what it should be.

### Get a writing key

**console.groq.com** → **API Keys** → **Create API Key**. No card needed.
Under **Music → Setup → Writing**, pick Groq, paste the key, save. That one setting
covers both studios.

OpenRouter is there as an alternative if Groq is rate-limiting you — its free models are
slower but the daily allowance is separate.

### Optional: a faster image source

Pollinations works with no key at all, but it only allows about one image every 15
seconds — a 15-shot scene pack takes four minutes.

**aistudio.google.com** → **Get API key** → create one. Free, no card,
**500 images a day with no waiting between them.** Paste it under
**Music → Setup → Images** and switch the provider to Gemini in the Scenes tab.

Both cap at roughly 1024 pixels on the long edge. No free image API anywhere gives you
true 4K — the canvas upscales, and the motion hides it.

At this point both studios are fully working. You could stop here.

---

## Stage 3 — Make it run itself (10 minutes, once)

This is the part that writes tomorrow's clips overnight and tells you what your
numbers are doing.

### 3a. Get a refresh token

A refresh token lets the nightly job read your channel without you being there.

1. Open **developers.google.com/oauthplayground**
2. Click the **gear icon** (top right) → tick **Use your own OAuth credentials** →
   paste your Client ID and Client secret from Stage 2.
3. In the left panel, scroll to the bottom, and in **Input your own scopes** paste:
   ```
   https://www.googleapis.com/auth/youtube.readonly
   ```
4. **Authorize APIs** → sign in with your channel's Google account → allow.
5. Click **Exchange authorization code for tokens**.
6. Copy the **Refresh token**. It looks like `1//0g...`

### 3b. Add the secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**.

Add four:

| Name | Value |
|---|---|
| `GROQ_API_KEY` | your `gsk_...` key |
| `GROQ_MODEL` | *(optional variable, not secret)* — a different model id |
| `GOOGLE_CLIENT_ID` | from Stage 2 |
| `GOOGLE_CLIENT_SECRET` | from Stage 2 |
| `GOOGLE_REFRESH_TOKEN` | from 3a |

Only `GROQ_API_KEY` is strictly required. Without the Google three you still get
clips and panels every morning, just no stats or performance-based suggestions.

### 3c. Let the workflow write to your repo

**Settings → Actions → General** → scroll to **Workflow permissions** →
select **Read and write permissions** → Save.

Without this the job runs but can't commit, and nothing appears on your site.

### 3d. Run it once by hand

**Actions** tab → **Nightly brief** (left sidebar) → **Run workflow** → **Run workflow**.

Takes about three minutes, most of it waiting on the image service. When it's green,
open your site — the dashboard is now full.

From then on it runs by itself every morning around 8:00 IST.

---

## Your daily loop after that

1. Open the site with your morning tea. Read what the numbers say.
2. **Open in the Shorts studio** — clips and panels are already loaded.
3. **Film 10 seconds.** Talk over it in Hindi if you want your own voice.
4. **Publish.** Repeat for clip two and three.
5. Download them and post to Instagram from your phone.

About fifteen minutes, most of it filming.

---

## Tuning it

Edit **`config.json`** in the repo — the nightly job reads it every run.

```json
{
  "handle": "@mohucool",
  "clipsPerDay": 3,
  "seed": 4412,
  "tone": "warm slapstick, family safe",
  "runningJoke": "Motu always steals food and Chotu always catches him",
  "castSheet": "...",
  "artStyle": "..."
}
```

- **castSheet** — the single most important field. The same wording goes into every
  panel forever. Change it and your characters change.
- **seed** — keep it fixed. Changing it re-rolls the whole look.
- **runningJoke** — leave empty for variety, fill it in to build a recurring bit.
  Recurring bits are what turn viewers into subscribers.
- **clipsPerDay** — 3 is the ceiling worth using. More is not better here.

To change when it runs, edit the `cron` line in
`.github/workflows/brief.yml`. It's in UTC: `30 2 * * *` is 08:00 IST.

---

## When something breaks

**Dashboard says "No brief yet"** — the workflow hasn't succeeded. Actions tab, open
the last run, read the red step.

**Workflow fails on the commit step** — Stage 3c. Read and write permissions.

**Workflow fails with "Groq 401"** — the key is wrong or has a stray space.

**"token refresh failed"** — the refresh token was made with a different client ID
than the secret you saved, or it was revoked. Redo 3a.

**Sign-in says the app is blocked** — you're not in Test users. Stage 2, step 3.

**Uploads land as private and you can't change it** — that's YouTube restricting
un-audited API projects. Flip each video public in YouTube Studio, or apply for a
compliance audit in the Cloud Console.

**Panels came back blank or missing** — the free image service was busy. The job
retries twice; re-run the workflow if you want them redrawn. Filming still works,
missing beats reuse the previous panel.


---

## What each screen now does

**Today** — channel numbers, what the model reads into them, what to do next, which
festival is coming, what's trending in India this morning, and the day's clips already
written and drawn.

**Music studio** — drop a track and it is analysed on the spot: tempo, energy,
brightness, dynamics. From that it picks one of eight visualisers and a matching palette
by itself. A quiet dark track gets Strings in violet; a fast bright one gets Pulse. You
can override any of it.

*Scenes* writes a shot list sized to the track — a three-minute song gets around fifteen
shots at twelve seconds each — with a single visual thread running through them, then
generates the images. Stop and restart at any point; it picks up from the shot it
reached.

**Shorts studio** — unchanged, and now follows whichever writing provider you picked in
the music studio.

---

## Nothing is lost if it crashes

**A rendered video is written to disk the instant it finishes — no YouTube connection
required.** You can render six tracks with Google never connected, close the laptop, come
back on Thursday, and they are all still sitting there ready to upload.

Restoring is automatic. There is no prompt to catch and nothing to click; open the app and
anything unpublished is already back in the list, marked *rendered*, with its title, tags
and detected mood intact. The **Saved on this device** panel on the Tracks screen shows
everything held locally, how much space it uses, and which items have not reached YouTube
yet. Each has its own Download and Delete.

Filmed Shorts clips work the same way and come back on their own too.

Scene images are deliberately not kept — twenty images per track would fill the quota fast,
and they regenerate in a couple of minutes. The shot list that produced them does survive.

### Pushing new code does not erase anything

This is worth being clear about, because it sounds like it should. The database belongs to
the **domain**, not to the files. Committing a new `music.html`, rewriting `core.js`,
re-running the workflow — none of it touches your stored videos. GitHub Pages replaces the
code; the browser keeps the data.

What *does* erase it:

- clearing browsing data or site data for `yourname.github.io`
- opening the app in a private or incognito window
- moving the app to a different domain, including switching to a custom domain
- the browser evicting it under storage pressure

The app asks the browser to pin the storage against that last one, and tells you on the
Tracks screen whether it was granted. If it says **not pinned**, the browser reserves the
right to reclaim the space, so use **Download everything unpublished** for anything you
would hate to re-render. It is one click and gives you real files on disk.

An interrupted **upload** resumes properly rather than starting over: YouTube's session
URL is kept, and on retry the app asks how many bytes arrived and sends only the rest.

**Publish → Back up to Drive** copies audio and video into a `Ridge` folder in your Google
Drive — 15 GB free on a standard account. The app uses the `drive.file` scope, which means
it can only ever see files it created. It cannot read anything else in your Drive.

Empty the local vault any time from **Tracks → Safe storage**.

---

## Tuning the nightly job

`config.json` also feeds the festival and trending awareness. The job knows the date, the
Indian season, and which festivals fall in the next three weeks, and it pulls YouTube's
most popular music in India each morning. It is told to work a festival in when one is
close, never to force it into every clip, and to use trending only to spot a travelling
format — never to copy a title or imitate a creator.

The festival dates live in the `FESTIVALS` table at the top of `scripts/brief.mjs`. Lunar
dates shift each year, so they are written out explicitly rather than calculated. The
table runs to early 2027 — extend it when you get there.

---

## Scheduling releases

**Publish → Release timing** in either studio. Three modes:

- **Publish immediately** — as before.
- **Space across the best slots** — the app lays your rendered batch across the strongest
  windows, never more than two in a day, and shows you the plan before you commit.
- **One specific time** — pick a moment yourself.

Scheduling works by uploading the video as private with a `publishAt` timestamp. YouTube
holds it and flips it public at that instant. It costs nothing extra and needs no second
API call.

### How the timing is chosen

When you connect Google, the app reads your last 50 uploads and scores every three-hour
window by views. Views are **age-adjusted** — otherwise a video from last year would win
every comparison simply for having had longer to accumulate them.

It refuses to schedule into dead hours. A 2 AM window can top a ranking just because two
videos happened to land there, and scheduling into it would waste the upload. Dead-hour
windows have to clear a much higher bar before the app will use one.

Below **good** confidence — roughly 25 long-form videos with at least 4 in the winning
window — your own data only *leads* and the published defaults fill in behind it. Thin
evidence trusted blindly is worse than no evidence.

The defaults, for Indian audiences: **long-form** late afternoon Wednesday and Friday,
mid-morning at weekends. **Shorts** run on a different clock — midday and mid-evening.
Both aim to publish two to three hours *before* the 6–9 PM IST viewing peak, so YouTube
has finished indexing by the time people arrive.

### Setting your daily limit

**Publish → Release timing → Daily upload limit.** Four options:

| Setting | Per day | When |
|---|---|---|
| Unverified | 12 | No phone verification yet |
| Verified | 100 | Phone verified, established channel — **yours** |
| Pacing deliberately | 20 | Verified but staying well inside |
| Set it myself | your call | — |

Two ceilings sit on top of each other and the lower one binds:

- **The API's Video Uploads bucket** — 100 calls a day. Documented by Google.
- **YouTube's per-channel daily cap** — undocumented. Community reporting puts unverified
  channels near 10–15 and verified ones around 100. Since your channel is verified and
  established, both land in the same place: **100**.

If YouTube does stop you, the app reads the `uploadLimitExceeded` error, pauses uploads
until the next reset at 12:30 PM IST, records the number you actually reached, and shows
it next time so you can set a realistic limit. Anything rendered stays rendered — nothing
is lost, and it is a 24-hour pause, not a strike.

**Scheduling does not raise this ceiling.** `publishAt` only moves when a video goes
*live*. The upload itself still happens today and still counts. Uploading 100 and
releasing them across a month is fine; uploading 200 in a day is not possible whatever the
release dates say.

### Two numbers people misread

**256 GB and 12 hours are per video, not per day.** Google's help page: *"The maximum file
size you can upload is 256 GB or 12 hours, whichever is less."* That is one file. A
three-minute music video at 1080p is around 100 MB, so you would need roughly 2,500 of
them to approach it in a single upload — and you can't, because they're separate files.

**15 minutes for unverified accounts is a length limit, not a count.** It caps how long
one video may run, not how many you may post.

### The upload ceiling moved

This app was originally built around a limit of six uploads a day. That is out of date.
Google moved `videos.insert` into its own **Video Uploads** quota bucket: 100 calls a day,
1 unit each, separate from the 10,000-unit general pool that thumbnails and channel reads
draw on.

So the six-a-day wall is gone. The limit you will actually meet first is YouTube's own
per-channel daily upload cap, which Google does not publish and which varies with channel
age and standing. It arrives as `uploadLimitExceeded`.

The header meter now counts against a **daily target you set yourself**, not a hard cap.
Set it in Publish → Release timing.

Worth saying plainly: being able to upload a hundred a day is not a reason to. Scheduling
helps because it separates *when you work* from *when things come out* — batch on Sunday,
release across the week. That reads as a consistent channel. Uploading thirty in one
afternoon reads as a dump, and performs like one.


---

## Why YouTube and Drive sign in separately

If you try to authorise both at once, Google refuses:

> This request contains scopes that cannot be requested together.
> Error 400: invalid_request

Google does not allow a single authorisation request to cover YouTube scopes and Drive
scopes at the same time. It is not a setting you can change and not something the consent
screen configuration fixes — declaring all three scopes in the Cloud Console is fine and
necessary, but the *request* must ask for one group or the other.

So the Publish tab has two buttons:

- **Connect YouTube** — uploads, channel info, release-timing history.
- **Connect Drive** — backup only, using `drive.file`.

Two consent screens, two tokens. You only need Drive if you want the backup; everything
else works without it. Each token lasts about an hour, and the app asks again when it
expires.

The nightly workflow is unaffected — it only ever asks for `youtube.readonly`.


---

## Drive not working? Enable the API

The most likely cause, and it catches nearly everyone: **the Drive API is switched off in
your Cloud project.** Turning on the YouTube Data API does not turn on Drive — they are
separate switches.

1. **console.cloud.google.com** → your project
2. **APIs & Services → Library**
3. Search **Google Drive API** → **Enable**
4. Give it a minute, then press **Connect Drive** again

The app now reads Google's error properly and will tell you this in the Drive panel rather
than showing a raw 403.

If it still fails: check `https://www.googleapis.com/auth/drive.file` is listed on your
**OAuth consent screen → Scopes**. Declaring it there is required; it only clashes with the
YouTube scopes when *requested* together, which the app already avoids.

### Or skip Drive entirely — use a folder

**Publish → Save to a folder.** Choose a folder once and every finished render is written
straight into it. No sign-in, no API to enable, no consent screen, no 15 GB cap. It is
limited by your disk, which answers the 10–100 GB question directly.

Tick **Write every render automatically** and videos land in the folder the moment they
finish, before any upload happens.

The trick worth knowing: **point it at your Google Drive desktop folder.** You get Drive
sync, on whichever account that machine is signed into, with none of the API plumbing. Same
for OneDrive or Dropbox. This also sidesteps the dual-account problem — the folder belongs
to whatever account the desktop app uses, which need not be your YouTube account.

Chrome, Edge and Opera on desktop support this. Firefox and Safari do not, and the app
disables the buttons and says so.

---

## Genres

**Look → Genre** offers 35 genres across seven families — Indian, Electronic, Acoustic,
Rock, Cinematic, Pop and Functional. Picking one sets four things at once: the visualiser,
the colour palette, the style of the scene art, and how the thumbnail reads.

Genre and mood work together rather than fighting. The genre decides the *look*; the
detected mood decides the *motion*. A slow track tagged Techno will not get the frantic
grid treatment — it switches to something calmer and tells you why in one line. A fast
track tagged Ambient goes the other way.

Leave the genre blank and everything follows the detected mood alone, as before.

---

## Suno prompts and lyrics

The **Suno** tab writes the brief you paste into Suno: a style prompt for the *Style of
Music* box, a title, and full lyrics with `[Verse]` / `[Chorus]` structure tags in Hindi,
English, Kumaoni or Hinglish — or instrumental with no lyrics at all.

It is told not to name artists or existing songs, because Suno rejects prompts that do.

**Keep this one** saves a brief to this device so you can return to the ones that worked.

This is the step the app cannot automate — Suno has no API and never has. What it can do is
write the brief, which is most of the thinking.


---

## Bringing images in from ChatGPT, Gemini or Midjourney

**Assist → Bring one in by hand.**

Automating those tools is not possible from this app, and not advisable anywhere. A popup
window is cross-origin: the app can open `chatgpt.com` but cannot read a single pixel out
of it, inject a prompt, or press a button. That is the browser's security model, not a
missing feature.

Getting round it needs a browser extension or a local Playwright script — and OpenAI treats
scripting the chat interface as grounds for suspension, alongside its API terms. Suno and
Google say much the same. A scraper also breaks whenever they change a CSS class, which is
roughly fortnightly.

So the app makes the manual hop take about five seconds instead:

1. **Write a detailed prompt** — a language model expands your idea into a full image
   brief: subject, composition, lens, lighting, palette, texture, and negative space on one
   side for the headline. It knows the track's genre, mood and thumbnail headline. This is
   most of why ChatGPT's images look better than a bare one-line prompt — the prompt
   writing, not the model.
2. **Open ChatGPT** or **Open Gemini** — the prompt is copied to your clipboard and the tab
   opens. Paste, press enter.
3. **Bring it back** — copy the image there, then press **Ctrl + V** anywhere in Ridge. It
   lands instantly. Dragging the downloaded file works too.

Choose where it goes: thumbnail background, the first scene of the selected track, or
appended as the next scene.

The Suno tab has the same hop — **Open Suno** copies the style prompt and lyrics together
and opens the create page. Drop the finished MP3 on the Tracks screen when it is done.

None of this touches anyone's terms, because you are the one using the site. The app just
removes the typing.


---

## Working from your phone

The whole thing is built to run on an Android phone, not just to survive on one.

Every control is at least 44 pixels tall on a touch screen, text inputs use 16px so the
browser does not zoom when you focus them, and a **sticky action bar** sits at the bottom
of each screen with that screen's main verb — Render, Generate, Publish — within thumb
reach. It follows whichever tab you are on.

Rendering works on mobile Chrome. A three-minute track still takes three minutes and the
tab must stay in front, so plug in and leave it.

---

## One button for the whole thing

**Tracks → Make the whole thing.** Drop a Suno track, pick a genre if you want one, press
it once. It runs the lot in order:

1. Write the title, description and tags
2. Plan the shot list
3. Draw the scenes
4. Build the thumbnail
5. Render the video

Each step shows a tick when it is done. If something fails — the image service is busy, a
key expired — it stops there, tells you which step and why, and the button changes to
**Carry on**. Pressing it again resumes from the failed step rather than repeating the work
already finished.

Then it is just Publish.

---

## The dashboard

Four cards across the top of **Today** take you straight into a job rather than into a
screen: start a music video, film the Shorts that were written overnight, write a Suno
brief, or schedule a release. Each one deep-links to the right tab, so tapping *Write a
Suno brief* opens the Suno tab directly instead of dropping you on Tracks to go hunting.

Below them sits everything the nightly job worked out: your numbers, what it reads into
them, what to do next, which release windows perform, what festival is coming, and what is
trending in India this morning.


---

## The uncommon visualisers

Five new ones, and four of them *accumulate* — the frame at 2:40 contains everything the
song has done up to that point, so the video ends on a finished image rather than a random
instant.

| | |
|---|---|
| **Terrain** | the spectrum carves a landscape and every past frame stays as a receding ridge — you end up flying over the shape of the whole song |
| **Rangoli** | twelve-fold symmetry drawn outward from the centre, complete at the last bar, and no two songs draw the same one |
| **Loom** | low frequencies lay the warp, highs throw the weft; the cloth is finished exactly when the track is |
| **Ink** | pigment blooming in water, a new bloom on every transient, never fully clearing |
| **Murmuration** | a flock that knots together on the bass and frays apart in the hats |

Fourteen visualisers in total now.

---

## Your NVIDIA key

It works — but only in the nightly workflow, not in the browser. I tested
`integrate.api.nvidia.com` from a live page and every endpoint fails with a CORS error.
That is a browser restriction; Node has no same-origin policy, so the workflow can call it
freely.

Add `NVIDIA_API_KEY` as a repository secret (your `nvapi-...` key). The nightly job will
prefer NVIDIA and fall back to Groq automatically if it errors. Set a repository *variable*
`NVIDIA_MODEL` to change the model from the default `meta/llama-3.3-70b-instruct`.

The same is true of OpenAI and Hugging Face. Both are blocked in the browser and both would
work in the workflow — so if you want ChatGPT writing your briefs, that is the route.

---

## Stock footage — the only sharp material available

**Scenes → Stock footage and photographs.** A free key from **pexels.com/api**, pasted
under Setup.

This matters more than it sounds. Every free AI image service caps at about 1024 pixels on
the long edge — I tested this directly. Pexels returns real 4K video clips and 5000px
photographs. For anything where sharpness shows, it is the only free route.

Tap any result to keep it. It downloads once and stays on this device, tagged with the
genre and mood that were active, so it is there next time without another download. Photos
also drop straight into the current track's scenes.

The nightly workflow also looks ahead — if a festival is close it searches for matching
footage and records what it found in the brief.

### About the 2 GB library

It cannot ship in the repo. GitHub Pages caps a site at 1 GB, and a repo that size becomes
painful to clone and push. What the app does instead is build the library *on your machine*,
where the only limit is your disk. Search, tap what is good, and it accumulates. Point the
folder feature at a synced folder and it backs itself up as it grows.

---

## On replacing Suno

I looked, and I am not going to pretend otherwise: there is no free, browser-callable
service that generates full songs with vocals at Suno's quality.

The open models that exist — MusicGen, Stable Audio, ACE-Step — are instrumental-first,
noticeably weaker, and their hosted endpoints block browser requests anyway. They would run
in the nightly workflow, but committing generated audio to a repo hits the same size wall
as the image library, and the output would be a downgrade on what you already get free from
Suno.

So Suno stays a manual step. The Suno tab writes the brief, copies it, and opens the tab —
which is the part that actually takes thinking.


---

## Rendering several at once

**Look → Render at once.** One, two or three.

Each track still plays through in real time — that cannot change, because the browser
records the canvas as it happens. What changes is that they overlap. Three six-second
tracks took 20 seconds one at a time and 8.9 seconds three at a time in testing, so a
little over twice as fast in practice rather than a clean 3×.

Parallel jobs render on their own offscreen canvases and never touch the speakers, so
nothing overlaps audibly. The accumulating visualisers — Terrain, Rangoli, Loom, Ink —
keep separate layers per lane, so two tracks rendering together do not bleed into each
other's picture.

On a phone, three at once is ambitious. If frames start dropping the recording stutters,
so drop back to one. On the Mac, three is comfortable.

---

## Storage on your phone

**Tracks → Safe storage → How much of this device to use.** Up to 50 GB.

Chrome grants a persisted origin roughly 60% of free disk, so with 100 GB free there is
room for tens of gigabytes. The bar shows how much of your budget is gone and turns amber
then red as it fills.

**Clear old published videos when it fills** is on by default. It only ever removes videos
that are already on YouTube, oldest first. Anything unpublished is never touched — that is
the work you would have to redo.

### The folder feature does not exist on Android

Worth knowing before you go looking for it. Chrome for Android, Firefox for Android and
the stock browser do not expose `showDirectoryPicker` at all — Android has no system file
picker that maps to it. So **Save to a folder is a desktop feature**. On your Mac it works;
on your phone the buttons are disabled and say so.

On the phone your options are the local vault, which is where everything goes anyway, and
Drive backup. Or render on the phone and download the files when you next have the Mac.

---

## The Lab

A fourth page, `lab.html`, wearing amber so you always know which room you are in.

Everything unproven lives there: workarounds, half-answers, and things that may stop
working next week. The Music and Shorts studios stay for things that work reliably. When
something in the Lab proves itself it moves out — Gemini images, Pexels footage, the
paste-back bridge and parallel rendering all started there.

It also carries a **provider probe** that fires real requests from your browser and reports
which services will actually answer. Run it whenever something stops working — it tells you
in ten seconds whether the problem is your key or the provider's door.

That probe caught itself lying, which is worth knowing about. It originally sent an
obviously-fake key and reported OpenAI as reachable. Send a key *shaped* like a real one
and OpenAI drops the request — an edge filter aimed at stopping people embedding keys in
web pages. It now probes with correctly-shaped all-zero keys, and reports OpenAI as blocked,
which is the truth.


---

## Publishing a video you already have

**Tracks → Publish something you already have.** Drop in an MP4, MOV, WebM or MKV — made
elsewhere, downloaded, or shot on your phone.

It skips rendering entirely and joins the same queue as everything else, so it still gets
AI-written titles and tags, a thumbnail, release scheduling and the local vault. The
one-click card notices it is already a finished video and only offers the two steps that
still apply.

Nothing is converted. YouTube accepts almost any format.

---

## Footage reels — the fast route

**Scenes → Footage reel.** No image generation at all.

A language model writes stock-footage *search terms* from the track's mood, tempo, genre
and whatever theme you type, ordered so the reel builds — establishing shots first, closer
and more intense later. Pexels returns real clips, they download, and the renderer cuts
between them **on the bar line**.

That last part is what makes it feel edited rather than assembled. With a detected tempo it
cuts every one, two or four bars, your choice; a 120 bpm track at two bars is a cut every
four seconds. Without a clear tempo it falls back to even spacing. Each cut carries a slow
push-in and a one-frame flash, so a short looping clip still reads as a deliberate edit.

Eight clips is usually plenty for a three-minute song — they cycle.

---

## Anime

**Shonen** is the fifteenth visualiser: radial speed lines, an impact burst, chromatic
split and a halftone screen. Four genres come with it — Anime Opening, Shonen Battle,
Anime Lofi and City Pop — each carrying its own palette, scene direction and Suno prompt.

Two things worth saying plainly.

**It is a style, not a series.** Cel shading, speed lines and impact frames are visual
grammar anyone can use. Named characters from Naruto or any other show are somebody's
copyright, and putting them on a monetised channel invites a claim. The scene prompts are
written to describe the look without naming a franchise, and you should keep them that way.

**The impact frames are deliberately rate-limited.** The first version inverted the whole
frame to white on every downbeat, which on a 150 bpm track meant flashing at roughly 2.5
times a second — inside the 3 Hz band that triggers photosensitive seizures. It now fires
at most once every 1.2 seconds and brightens toward the accent colour instead of going
white. Measured at about 0.5 Hz with no white frames at all. If you edit that visualiser,
leave the rate limit alone.

---

## Thumbnail layouts

Six, under **Assist → Thumbnail**:

**Bottom bar** — accent rule, big headline over a scrim. **Split diagonal** — a hard
gradient wedge across the lower corner. **Centre stack** — headline over a vignette.
**Left panel** — text on solid, art on the right. **Sticker** — outlined caps, no scrim,
reads on anything. **Gradient wash** — duotone multiply over the art.

Headline colour can be white, the accent, an accent gradient, or near-black for light
backgrounds.


---

## Flash safety

Every visualiser now passes through a guard before anything reaches the screen or the
recording.

The standard here is real. WCAG 2.3.1 and the Ofcom guidance both put the danger line at
**more than three flashes a second**, where a flash means a relative-luminance swing of 10%
or more. About one person in 4,000 has photosensitive epilepsy and it most commonly first
appears in childhood, which is exactly the audience a music channel reaches without
choosing to.

Rather than trusting fifteen visualisers to each behave, the limit is enforced centrally, at
the last step of every frame. It measures the luminance of what was just drawn, compares it
to the previous frame, and if the jump is too large or too frequent it blends the previous
frame back in until the change sits inside the limit. The result reads as a soft pulse
instead of a strobe. A visualiser written carelessly — or one added later — is contained by
it automatically.

### What the measurements say

Every visualiser was driven with a deliberately hostile signal: full-scale bass alternating
every other frame at 30fps, which is a 15 Hz drive — about the worst thing you can feed a
visualiser.

| | flashes/sec | largest jump | |
|---|---|---|---|
| Terrain, Murmuration, Loom, Rangoli, Ink | 0 | 0.002 – 0.019 | inherently safe |
| Shonen, guard **off** | **2.67** | **0.404** | four times the flash threshold |
| Shonen, guard **on** | **0** | 0.058 | contained |

And in the live app on a real track, all fifteen: zero flashes a second except Shonen at
0.52, well inside the limit.

The toggle is in **Look → Flash safety**, on by default. There is no good reason to turn it
off, and the app says so.

---

## Anime, and what cannot be built

You have asked twice for Akatsuki and Naruto Shippuden, so here is the straight answer.

A black cloak with red clouds is not a genre. It is a specific costume design owned by
Shueisha and Studio Pierrot, and an image generator producing it is producing their
character design. On a monetised channel with real subscribers, that invites a Content ID
match or a manual claim, and the claim lands on the video — the strike is against you, not
against the tool that made the picture. That is the practical argument, and it is the one
that matters for your channel.

What is not owned by anyone is the atmosphere people actually mean. So there are now four
genres carrying it:

**Dark Ninja** — rain-soaked stone village at night, a hooded silhouette on a rooftop,
lantern glow through downpour, indigo and blood red, no visible face.
**Rain Village** — perpetual rain, grey towers, paper talismans, standing water reflecting
neon, desaturated blue melancholy.
**Sword Duel** — two silhouettes across a courtyard at dawn, petals held in a still frame,
the moment before movement.
**Mecha** — industrial hangar, vast machine silhouette, warning lights, steam, cold steel
and hazard orange.

All the mood, none of the claim. The same reasoning removed studio names from every prompt
in the app — a scene that used to say "Pixar-style" now says "animated feature style",
which describes the same look without naming somebody's company.

---

## One button, three routes

**Tracks → Make the whole thing → How to make it.**

**Decide for me** picks from what the track and your keys allow: fast, tempo-driven music
with a Pexels key gets cut footage; slow or beatless music gets generated scene art; with no
image source at all it falls back to the visualiser alone. The card tells you which route it
chose before you commit.

**Stock footage cut to the beat** is the quickest — no image generation, real clips, cuts on
the bar line.
**Generated scene art** is the most distinctive but the slowest.
**Visualiser only** skips imagery entirely and finishes in the time the song takes to play.

Steps that do not apply to the chosen route are hidden rather than skipped silently, so the
tick list always matches what is actually going to happen.

---

## 51 genres

Eight families now: Indian, Electronic, Acoustic, Rock, Cinematic, Pop, Anime and
Functional — including Drill, UK Garage, Bhangra Fusion, Carnatic, Trap Soul, Post-Punk,
Devotional Chant and a Kids &amp; Family preset written to keep everything bright, simple and
free of anything frightening.
