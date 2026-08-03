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

### Get a Groq key while you're at it

**console.groq.com** → **API Keys** → **Create API Key**. No card needed.
Paste it into **Setup** alongside the client ID and save.

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
