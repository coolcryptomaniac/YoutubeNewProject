# Song releases

One folder per song: `release.json` (title, genre, language, lyrics, optional choiceFallbacks/releaseDate),
`cover.jpg` (3000×3000 JPG) and `master.mp3` or `master.wav`.

Release to Vusic: Actions → **Vusic E2E Canary** → Run workflow → mode `release`, slug = folder name.
It signs in to Ridge Cloud with GitHub OIDC (no secrets in the repo), stages the files in R2 and
submits the Vusic single-release wizard. Defaults: Mohit Pandey as artist/composer/lyricist,
label Vusic Records, all platforms, not explicit, release date tomorrow (IST).
