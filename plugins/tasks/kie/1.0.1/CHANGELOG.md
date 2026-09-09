---
changelogVersion: 1
plugin: "kie"
version: "1.0.1"
locale: "en"
---
# Changelog

## [1.0.1]

### Fixed

- Declare the native status route as
  `GET /kie/api/v1/jobs/recordInfo/:taskId` with a path parameter instead of
  `GET /kie/api/v1/jobs/recordInfo` with a query string, so the route passes
  gateway validation (`query` routes must carry the `:taskId` segment).
  Upstream requests to KIE still use `GET /api/v1/jobs/recordInfo?taskId=...`;
  only the gateway-facing native route changes.

### Migration

- Pricing and billing are unchanged. Native clients polling the gateway must
  call `/kie/api/v1/jobs/recordInfo/<taskId>` instead of
  `/kie/api/v1/jobs/recordInfo?taskId=<taskId>`. The `openai_responses` and
  `openai_video` protocol paths are unaffected.
