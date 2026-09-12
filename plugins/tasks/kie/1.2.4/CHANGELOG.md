# kie 1.2.4

- Publish the curated 74 currently available KIE Market generation product groups: 28 image, 40 video and 6 audio products.
- Map each public product group to its default KIE `createTask` ID while keeping the user-facing model name unchanged.
- Improve usage reservation and settlement metadata for image, video and audio products.
- Keep only `openai_responses` and `openai_video` in plugin metadata, compatible with current production New API builds.
- Leave the experimental `openai_images` implementation unreleased until New API core recognizes that task protocol.
