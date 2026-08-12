# Ridge Provider Scout

`Provider scout` is Ridge's low-cost technology watch for new models and tools that may improve music, image, text, video, speech and publishing workflows.

## Schedule

- **Weekly:** Monday morning IST. Quick scan of official sources plus recently modified Hugging Face models.
- **Monthly:** first day of each month. Same scan with a wider discovery window and deeper process-improvement checklist.
- Both modes can also be run manually from GitHub Actions.

The workflow is `.github/workflows/provider-scout.yml`; the scanner is `scripts/provider-scout.mjs`.

## Cost design

The scout does not call an LLM. It uses public HTTP endpoints and deterministic rules, so routine discovery does not consume Groq, Mistral, Cloudflare Workers AI, Hugging Face inference, Suno or image/video credits.

The report is written to the GitHub Actions job summary and opened as a GitHub issue so there is a human approval point before Ridge changes production providers.

## Sources watched

Current primary sources include:

- Mistral model, subscription and audio documentation.
- Cloudflare Workers AI model catalog and pricing documentation.
- Hugging Face Inference Providers pricing and recent model metadata.
- Recent Hugging Face models for text generation, text-to-image, text-to-video, text-to-audio and speech recognition are inspected for inference-provider metadata.

More official sources can be added to `SOURCES` / `TASKS` in `scripts/provider-scout.mjs` without changing the workflow.

## Free-only rules

A new model is never automatically enabled. Before promotion it must pass all of these:

1. Official API/documentation exists.
2. Free/free-tier behavior is verified and Ridge can fail closed rather than spill into paid usage.
3. Publishing/license terms fit the intended content.
4. It beats or meaningfully complements the current option on Ridge's own test media/prompts.
5. Provider failure is isolated and cannot stop other destinations/providers.
6. The option remains experimental until enough evidence exists to promote it.

Open weights are **not** treated as proof that hosted inference is free.

## Mistral position in Ridge

Mistral is worth testing in focused roles:

- **Voxtral:** transcription, multilingual lyrics and word timestamps.
- **Mistral Small / Medium:** structured metadata, second-opinion editing, reasoning and agentic/code tasks.
- **OCR:** extracting structured information from distributor documents/forms/screenshots when DOM data is unavailable.
- **Image generation:** experimental only; Ridge keeps its dedicated image routes and exact local 3000×3000 cover compositor as the default.

Mistral API Free mode can be used when available to the account, but Ridge must never automatically upgrade or switch to paid API usage.

## What the reports recommend

Weekly reports focus on concrete experiments worth trying. Monthly reports also review process questions such as provider reliability, quota failures, latency, title/content quality, lyric alignment, render completion rate and time-to-publish. The goal is not to accumulate provider logos; it is to remove friction and improve measurable content outcomes.
