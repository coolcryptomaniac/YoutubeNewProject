# Ridge Release Automation

Ridge Release Hub lives at `/release.html`.

## Security model

Never put Vusic, Meta, or LinkedIn credentials in GitHub Pages, `config.json`, localStorage, or source control. Provider credentials live only as Cloudflare Worker secrets. The Release Hub uses a separate `RIDGE_ADMIN_TOKEN` to authorize publishing calls; enter that token only when using the Release Hub tab.

YouTube is different: Ridge uses Google OAuth in the browser and never stores a Google/YouTube password.

## Required Worker secret

```bash
npx wrangler secret put RIDGE_ADMIN_TOKEN
```

Use a long random value.

## VusicStudio browser automation

Vusic has no documented public release-upload API, so Ridge uses Cloudflare Browser Run only when you explicitly submit a release.

```bash
npx wrangler secret put VUSIC_USERNAME
npx wrangler secret put VUSIC_PASSWORD
```

The browser binding is declared as `BROWSER` in `wrangler.toml`.

The automation is aligned to the real VusicStudio single-release wizard observed in August 2026:

1. `/?login=true` — email + password + **Sign In**.
2. `/song-release` — choose **Upload Single**.
3. `/single-song` — upload exact 3000×3000 JPG artwork and WAV/MP3 master.
4. **Go Live Date** — set release date and whether the track was released previously.
5. **Song Details** — title, genre, lyrics and related metadata.
6. **Artist** — choose the supplied primary artist and fill composer/lyricist where shown.
7. **Platforms** — select requested destinations, or Select All when none are specified.
8. **Agreement** — sign/accept the release agreement.
9. **Review** — final submission occurs only when `confirmSubmit: true` is supplied by Release Hub.

Default routes are built into Ridge. They can still be overridden with `VUSIC_LOGIN_URL`, `VUSIC_NEW_RELEASE_URL`, and `VUSIC_SINGLE_RELEASE_URL` if Vusic changes them.

Generic semantic selectors are used first. If Vusic changes individual controls, override only the affected selectors:

- `VUSIC_LOGIN_USER_SELECTOR`
- `VUSIC_LOGIN_PASSWORD_SELECTOR`
- `VUSIC_LOGIN_SUBMIT_SELECTOR`
- `VUSIC_AUDIO_SELECTOR`
- `VUSIC_ARTWORK_SELECTOR`

Ridge does not bypass CAPTCHA, OTP, two-factor authentication, or other human verification. A Vusic run stops with `VUSIC_HUMAN_VERIFICATION_REQUIRED` if one appears.

## Temporary media staging with R2

Create a small R2 bucket, for example `ridge-release-media`, then add this to `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "RELEASE_MEDIA"
bucket_name = "ridge-release-media"
```

The Release Hub uploads the master audio and generated cover into random, six-hour staging objects. The Worker serves those objects over HTTPS to Vusic/Instagram. No bucket-wide public access is required. Staging is capped at 60 MB per file.

## LinkedIn

Use an approved LinkedIn application/token. Store the access token and author URN as secrets:

```bash
npx wrangler secret put LINKEDIN_ACCESS_TOKEN
npx wrangler secret put LINKEDIN_AUTHOR_URN
```

## Facebook Page

```bash
npx wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
npx wrangler secret put FACEBOOK_PAGE_ID
```

## Instagram

Instagram publishing requires a professional account and a Meta access token.

```bash
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN
npx wrangler secret put INSTAGRAM_USER_ID
```

## YouTube

Open `music.html` → Setup and save your Google OAuth client ID. Release Hub asks Google for `youtube.upload` permission when you click **Connect YouTube**. No Google password is stored.

## Release Hub workflow

1. Enter song title, primary artist, genre and go-live date.
2. Enter composer, lyricist and final lyrics.
3. Generate the exact 3000×3000 JPG cover locally.
4. Select WAV/MP3 master and optional release video.
5. Stage audio + cover to R2.
6. Select Vusic, LinkedIn, Facebook, Instagram and/or YouTube.
7. Leave **Final Vusic submit** checked for a full release submission, or uncheck it to stop safely on Vusic Review.
8. Click **Distribute + cross-post**.
9. Each destination runs independently and reports its own success/failure.

## Free-tier behavior

Browser Run is invoked only for an explicit Vusic submission. Ridge does not poll the Vusic dashboard in the background.
