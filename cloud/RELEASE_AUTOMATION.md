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
npx wrangler secret put VUSIC_LOGIN_URL
npx wrangler secret put VUSIC_NEW_RELEASE_URL
```

The browser binding is already declared as `BROWSER` in `wrangler.toml`.

Default selectors deliberately use generic form semantics. If Vusic's dashboard differs, configure only the selectors that need changing as Worker vars/secrets:

- `VUSIC_LOGIN_USER_SELECTOR`
- `VUSIC_LOGIN_PASSWORD_SELECTOR`
- `VUSIC_LOGIN_SUBMIT_SELECTOR`
- `VUSIC_TITLE_SELECTOR`
- `VUSIC_ARTIST_SELECTOR`
- `VUSIC_GENRE_SELECTOR`
- `VUSIC_AUDIO_SELECTOR`
- `VUSIC_ARTWORK_SELECTOR`
- `VUSIC_RELEASE_SUBMIT_SELECTOR`

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

The current adapter posts text to the authenticated author. Media upload can be added when the LinkedIn application has the necessary publishing/upload permissions.

## Facebook Page

Ridge publishes through the supported Facebook Page API, not by storing a Facebook password.

```bash
npx wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
npx wrangler secret put FACEBOOK_PAGE_ID
```

## Instagram

Instagram publishing requires a professional account and a Meta access token. Ridge publishes staged cover images or staged video URLs.

```bash
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN
npx wrangler secret put INSTAGRAM_USER_ID
```

## YouTube

Open `music.html` → Setup and save your Google OAuth client ID. The Release Hub reuses that client ID and asks Google for `youtube.upload` permission when you click **Connect YouTube**. No Google password is stored.

## Release Hub workflow

1. Enter song title and artist; Ridge generates a deterministic 3000 × 3000 JPEG locally.
2. Select the master audio and optional release video.
3. Stage audio + cover to R2.
4. Select Vusic, LinkedIn, Facebook, Instagram and/or YouTube.
5. Click **Distribute + cross-post**.
6. Each destination runs independently and reports its own success/failure; one platform failure does not cancel the others.

## Free-tier behavior

Browser Run is invoked only for an explicit Vusic submission. Ridge does not poll the Vusic dashboard in the background, which conserves the Browser Run free allowance.
