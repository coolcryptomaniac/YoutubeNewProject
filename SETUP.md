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
   - **Scopes** → Add or remove scopes → paste
     `https://www.googleapis.com/auth/youtube.upload` → Update → Save
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

Audio and finished videos go into the browser's own database, not just memory. Close the
tab, crash, lose power — reopen and the Tracks screen offers to restore everything. Shot
lists, metadata and detected moods come back too. Scene images have to be regenerated,
since storing twenty images per track would fill the vault quickly.

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
