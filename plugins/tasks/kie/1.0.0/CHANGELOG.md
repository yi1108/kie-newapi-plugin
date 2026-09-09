---
changelogVersion: 1
plugin: "kie"
version: "1.0.0"
locale: "en"
---
# Changelog

## [1.0.0]

### Added

- Initial release bridging the KIE Market asynchronous job API
  (`POST /api/v1/jobs/createTask`, `GET /api/v1/jobs/recordInfo`) as a New API
  task plugin.
- Covers 141 generation models across image, video, and audio categories
  (including Seedream/Seedance, Kling, Wan, Hailuo, Nano Banana, Ideogram,
  Flux, Imagen, Qwen-Image, Grok Imagine, MiniMax, PixVerse, OmniHuman,
  Recraft, Topaz, Happyhorse, Infinitalk, ElevenLabs, Gemini TTS and Z-image);
  model-specific
  parameters pass through unchanged in the vendor `input` object, so newly
  released Market models work without plugin updates.
- Exposes the KIE job endpoints on native routes (`POST /kie/api/v1/jobs/createTask`,
  `GET /kie/api/v1/jobs/recordInfo`) and implements the `openai_responses`
  (stream, sync, background) and `openai_video` protocols.
- Maps `waiting`/`queuing`/`generating`/`success`/`fail` states to task
  statuses, surfaces `failCode`/`failMsg` as failure reasons, and classifies
  KIE envelope error codes as terminal (401, 403, 402, 404, 422, 433, 501,
  505) or
  retryable (408, 429, 455, 5xx).
- Serves generated media as proxied image, video, and audio artifacts
  (including Seedance first/last frames and OmniHuman subject masks), and
  renders text-only results such as human-identification `subject_status`.
- Usage is reserved and settled per delivered file (`results` count). Billing
  is unchanged: configure the New API model price per file as on the KIE
  pricing page; no Migration action is required beyond setting the channel key.
