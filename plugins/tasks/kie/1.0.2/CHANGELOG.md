changelogVersion: 1
plugin: "kie"
version: "1.0.2"
locale: "en"
---
# Changelog

## [1.0.2]

### Fixed

- Declare `audio_characters` using the host's token-compatible numeric unit so
  plugin metadata passes New API task-plugin validation. The runtime usage
  value remains the submitted speech or dialogue character count; request and
  model behavior are unchanged.
