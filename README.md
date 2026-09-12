# KIE.AI New API Plugin

[English](#english) · [中文](#中文)

一个 [New API](https://github.com/QuantumNous/new-api) 第三方任务插件（task plugin），通过 KIE 统一的异步任务 API 桥接 Market 生成能力。当前目录包含 **76 个生成类产品**（其中 2 个 Coming Soon）和 29 个 Chat 类产品（其中 2 个 Coming Soon）。

最新 `1.2.4` 只对外暴露 **74 个当前可用的生成产品分组**：图像 28、视频 40、音频 6；2 个 Coming Soon 生成产品不开放。每个公开产品组在插件内部映射到一个默认的具体 `createTask` ID，变体、档位和子工具不再作为独立模型展示。旧 `1.0.2` 的 141 个具体调用 ID 仅保留用于回滚，不应用于新部署。

KIE 的生成模型共用同一套 `createTask` / `recordInfo` 契约，因此本插件仍是薄桥接层：产品专属参数原样放在 `input` 中透传。新产品或 Coming Soon 产品上线后，应先确认真实产品组、默认 `createTask` ID、参数和价格，再升级目录；已开放产品新增 `input` 参数时，通常不需要更新插件。

---

# 中文

## 1. 安装

### 方式 A：第三方插件源（推荐）

把本仓库的 `index.json` 原始地址添加到 New API 管理后台的插件市场（例如发布到 GitHub 后）：

```
https://raw.githubusercontent.com/<owner>/<repo>/main/index.json
https://raw.githubusercontent.com/yi1108/kie-newapi-plugin/main/index.json
```

然后在市场中安装 **KIE.AI**（key: `kie`）。

### 方式 B：手动上传

上传 `plugins/tasks/kie/1.2.4/plugin.js`，图标可选 `plugins/tasks/kie/icon.svg`。

## 2. 绑定渠道

1. 新建渠道，类型选择 **任务插件（Task Plugin，type 61）**。
2. 插件 key 填 `kie`。
3. 密钥填你的 KIE API Key（<https://kie.ai/api-key>）。
4. Base URL 留空即使用默认的 `https://api.kie.ai`。
5. 启用 74 个当前可用的生成产品分组；Coming Soon 产品和具体变体不要手动加入能力列表。

> ⚠️ 渠道页的「测试」按钮对任务插件渠道固定返回 **Task Plugin channel test is not supported**——这是 New API 核心的设计（Midjourney / Suno / Kling / 即梦等所有异步任务渠道都一样），不代表配置有误。验证渠道请直接提交一次真实任务（见下节）。

## 3. 调用方式

### 3.1 原生 KIE 兼容端点（现有 KIE 集成可直接换域名）

```bash
# 提交任务（与 KIE 官方请求体完全一致）
curl -X POST "$NEWAPI/kie/api/v1/jobs/createTask" \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedream-api",
    "input": { "prompt": "a cat astronaut", "max_images": 2 }
  }'
# -> { "code": 200, "msg": "success", "data": { "taskId": "..." } }

# 查询任务
curl "$NEWAPI/kie/api/v1/jobs/recordInfo/<taskId>" \
  -H "Authorization: Bearer $NEWAPI_TOKEN"
```

`input` 支持的全部参数以 [KIE 文档](https://docs.kie.ai/1973359m0) 中各模型页为准，插件不做裁剪。支持可选的 `callBackUrl`。

### 3.2 OpenAI Responses 协议（`POST /v1/responses`，支持 stream / sync / background）

```json
{
  "model": "nano-banana-2",
  "input": "一只穿雨衣的柴犬，电影感"
}
```

- 多模态输入：`input` 中可使用标准 `input_text` / `input_image` 部件，图片自动汇入 `input.image_urls`。
- 模型专属参数：放在 `metadata.input` 中（如 `{"duration": 5, "resolution": "720p"}`），与 prompt 自动合并。
- 完成后以 `<img>` / `<video controls>` / `<audio controls>` 标签返回产物链接（经网关代理）。

### 3.3 OpenAI Video 协议（`POST /v1/videos`）

```json
{
  "model": "kling-3-0",
  "prompt": "穿越云层的一镜到底",
  "images": ["https://example.com/ref.jpg"],
  "metadata": { "input": { "duration": 5 } }
}
```

也支持 `multipart/form-data`，但**只接受 URL 字段，不接受文件上传**（见下节）。

### 3.4 图片生成

```json
{
  "model": "gpt-image-2-5",
  "input": "一个红色小圆点"
}
```

当前生产版通过 `POST /v1/responses` 使用图片产品，已验证 `gpt-image-2-5` 可正常出图。`POST /v1/images/generations` 的任务协议仍保留为实验代码，但当前 New API 生产核心尚未识别 `openai_images`，所以 `1.2.4` 不声明该协议；不要把图片任务发到 `/v1/images/generations` 或 `/v1/chat/completions`。

## 4. 参考图片 / 视频 / 音频

KIE 只接收 URL：先用 KIE 文件上传 API（`https://kieai.redpandaai.co/api/file-url-upload` 等，免费、24 小时后删除）换取 URL，再把 URL 放进模型文档要求的字段（通用字段名为 `image_urls`），例如：

```json
{ "model": "kling-3-0-turbo",
  "input": { "prompt": "缓慢推近", "image_urls": ["https://.../ref.jpg"] } }
```

## 5. 产物与计费

- 产物（图 / 视频 / 音频，含 Seedance 的首帧/尾帧、OmniHuman 抠像 mask）由网关按 artifact 代理转发，KIE 原始链接约 24 小时过期，请及时转存。
- 图像 / 工具模型使用 `results` = **实际交付的文件数**；提交时按 `max_images` / `n` / `batch_size` 等参数预占（默认 1，上限 8），完成后按真实数量结算。
- 视频模型使用组合用量：`seconds`、`resolution`、`tier`、`generate_audio`、`input_images`、`input_video_seconds`。插件根据 KIE 官方文档中的 `duration`、`resolution`、`mode`、`audio` / `sound`、参考图/视频等参数预占；例如 Kling 3.0 的 `mode=std/pro/4K` 映射到 720p/1080p/4K，Wan 3.0 默认 1080p 且默认带音频，Hailuo 默认 6 秒/768p。KIE 查询记录通常不回显原始视频参数，因此完成时保留提交预占用量。
- 音频模型继续按 `results` 预占文件数；TTS / Dialogue 类模型会额外上报 `audio_characters`，由 `text` / `prompt` / `dialogue` 估算字符数。ElevenLabs 未指定音色时默认使用文档 voice id `N2lVS1w4EtoT3dr4eOWO`，并接受 `voiceId` / `voice_id` 别名。
- 公开目录按产品组计费；插件内部选择的默认变体只用于提交 KIE 任务，不改变用户看到的模型名。

## 6. KIE 错误码

| code | 含义 | 插件行为 |
| --- | --- | --- |
| 401 / 403 | 鉴权失败 / 禁止访问 | 任务失败 |
| 402 | 余额不足 | 任务失败 |
| 404 / 422 / 433 / 501 / 505 | 不存在 / 参数 / 子 key 限制 / 生成失败 / 功能关闭 | 任务失败，返回 msg |
| 408 / 429 / 455 / 5xx | 超时 / 限流 / 维护 / 临时错误 | UNKNOWN，由网关继续轮询 |

## 7. 同步对话模型（不在本插件内）

KIE 的 Claude / GPT / Gemini / Grok / Codex 等**同步对话**模型不是异步任务，New API 的任务插件体系不承载它们，请用原生通道接入。实时页面共有 29 个 Chat 产品组，其中 27 个可用、2 个 Coming Soon；生产口径应只开放已经真实验证过的 Chat 产品组，用户看到的模型名保持产品组名称，不加 `kie/` 前缀。

普通 Chat 客户端使用 `/v1/chat/completions`；Codex / Grok Responses 能力使用 `/v1/responses`。具体协议、Base URL 和可用性以实时页面及本地真实验证结果为准，不要把旧文档中的变体名直接扩展成新模型。

## 8. 开发

```bash
node build/build_product_catalog.mjs --live=<pagePlaygroundGroup.json>
python build/build_plugin.py     # 由 build/product-groups.json + 模板生成 plugin.js
node build/smoke-test.mjs        # 离线钩子测试（36 项）
node build/build_index.mjs       # 生成 index.json（meta 派生字段 + sha256）
```

---

# English

A third-party [New API](https://github.com/QuantumNous/new-api) task plugin bridging KIE's unified asynchronous job API. The current catalog contains **76 generation products** (2 Coming Soon) and 29 Chat products (2 Coming Soon).

Release `1.2.4` exposes only the **74 currently available generation product groups**: 28 image, 40 video and 6 audio. The two Coming Soon generation products stay hidden. Each public product group maps internally to one default concrete `createTask` ID; variants, tiers and sub-tools are no longer presented as separate models. Release `1.0.2` with its 141 concrete call IDs is retained only for rollback.

KIE generation models share the same `createTask` / `recordInfo` contract, so the plugin remains a thin bridge: product-specific parameters pass through unchanged in `input`. A newly released or Coming Soon product should be verified for its real product group, default `createTask` ID, parameters and price before being added to the catalog; new `input` parameters for an already enabled product generally need no plugin update.

## Install

- **Third-party marketplace:** add the raw URL of this repository's `index.json` as a plugin source, then install **KIE.AI** (`kie`).
- **Manual:** upload `plugins/tasks/kie/1.2.4/plugin.js` (and optionally `icon.svg`).

## Bind a channel

Create a **Task Plugin** channel (type 61), set `task_plugin_key=kie`, paste your KIE API key (<https://kie.ai/api-key>), and leave Base URL empty to default to `https://api.kie.ai`. Enable the 74 available generation product groups only; do not add Coming Soon products or concrete variants as separate abilities.

> ⚠️ The channel **Test** button always returns *Task Plugin channel test is not supported* for type-61 channels. This is by design in New API core (same for Midjourney/Suno/Kling/Jimeng and every other async task channel) — it is not a configuration error. Verify the channel by submitting a real task instead.

## Calling the plugin

1. **Native KIE routes**: `POST /kie/api/v1/jobs/createTask` and `GET /kie/api/v1/jobs/recordInfo/:taskId`, using a public product group as `model` (`input` and optional `callBackUrl` still follow KIE's payload shape).
2. **OpenAI Responses** (`POST /v1/responses`, stream/sync/background): send `{model, input}`; standard `input_text`/`input_image` parts map to `prompt`/`image_urls`; extra vendor parameters go under `metadata.input`. Completed files render as proxied `<img>` / `<video>` / `<audio>` tags.
3. **OpenAI Video** (`POST /v1/videos`): `{model, prompt, images?, metadata:{input:{...}}}`; JSON or multipart, URL references only (no file uploads).
4. **Image generation**: use `POST /v1/responses` with an image product such as `gpt-image-2-5`. The experimental OpenAI Images task protocol is intentionally not declared in `1.2.4` until production New API core supports `openai_images`.

Reference media is URL-only on KIE: upload first with the KIE File Upload API (free, deleted after 24h), then pass the URL in the model's documented field (typically `image_urls`).

## Artifacts & billing

- Images, videos and audio — including Seedance first/last frames and OmniHuman masks — are served through gateway-proxied artifacts. Upstream content links expire in roughly 24 hours.
- Image models use `results` for delivered files: reserved at submit from `max_images` / `n` / `batch_size` (default 1, capped at 8), settled to the real count on completion.
- Video models use combined usage facts: `seconds`, `resolution`, `tier`, `generate_audio`, `input_images` and `input_video_seconds`. The plugin reserves usage from KIE's documented `duration`, `resolution`, `mode`, `audio` / `sound`, reference image and reference video parameters; for example, Kling 3.0 `mode=std/pro/4K` maps to 720p/1080p/4K, Wan 3.0 defaults to 1080p with audio, and Hailuo defaults to 6 seconds at 768p. KIE record responses usually do not echo the original video parameters, so completion keeps the submit reservation.
- Audio models keep `results` for output files; TTS / Dialogue models also report `audio_characters` estimated from `text` / `prompt` / `dialogue`. ElevenLabs defaults to the documented voice ID `N2lVS1w4EtoT3dr4eOWO` and accepts `voiceId` / `voice_id` aliases.
- Billing is attached to the public product group. The internal default variant is only used to submit the KIE job and does not rename the user-facing model.
- Permanent envelope errors (401/403/402/404/422/433/501/505) fail the task with the KIE message; transient ones (408/429/455/5xx) map to UNKNOWN and keep polling.

## Synchronous chat models

Chat models are not tasks and cannot live in a task plugin. Bind native channels instead. The live page has 29 Chat product groups (27 available, 2 Coming Soon); enable only Chat product groups that have passed real local verification, without a `kie/` prefix. Regular chat clients use `/v1/chat/completions`, while Codex/Grok Responses capabilities use `/v1/responses`.
