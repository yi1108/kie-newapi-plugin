---
changelogVersion: 1
plugin: "kie"
version: "1.0.1"
locale: "en"
---
# Changelog

## [1.0.1]

### Changed

- Video billing now reports official-style combined usage facts instead of a
  flat generated-file count. The plugin reports output `seconds`, output
  `resolution`, product `tier`, `generate_audio`, `input_images`, and
  `input_video_seconds`.
- Audio billing still reports generated output files through `results`; TTS and
  dialogue models additionally report `audio_characters` from the submitted
  `text`, `prompt`, or `dialogue` input.
- The plugin includes pricing display examples for image, video, and TTS
  requests.

### Fixed

- Declare the native status route as
  `GET /kie/api/v1/jobs/recordInfo/:taskId` with a path parameter instead of
  `GET /kie/api/v1/jobs/recordInfo` with a query string, so the route passes
  gateway validation (`query` routes must carry the `:taskId` segment).
  Upstream requests to KIE still use `GET /api/v1/jobs/recordInfo?taskId=...`;
  only the gateway-facing native route changes.

### Migration

- Pricing configuration must be reviewed. Video prices previously configured as
  a per-file `results` price no longer apply to video usage. Configure video
  billing expressions against `seconds`, `resolution`, `tier`,
  `generate_audio`, `input_images`, and `input_video_seconds`.
- If an earlier local build used `video_480p_seconds`,
  `video_720p_seconds`, `video_1080p_seconds`, or `video_4k_seconds`, replace
  those prices or expressions with the new combined `seconds` + `resolution`
  facts.
- Configure `audio_characters` for TTS / dialogue models when upstream pricing
  is character-based; otherwise keep using `results` for per-file audio
  pricing.
- Native clients polling the gateway must call
  `/kie/api/v1/jobs/recordInfo/<taskId>` instead of
  `/kie/api/v1/jobs/recordInfo?taskId=<taskId>`. The `openai_responses` and
  `openai_video` protocol paths are unaffected.
