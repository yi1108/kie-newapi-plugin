# KIE.AI New API Plugin

[English](#english) · [中文](#中文)

一个 [New API](https://github.com/QuantumNous/new-api) 第三方任务插件（task plugin），通过 KIE 统一的异步任务 API 覆盖 **141 个 Market 生成模型**：图像 57、视频 78、音频 5、工具 1（Seedream/Seedance、Kling、Wan、Hailuo、Nano Banana、Ideogram、Flux、Imagen、Qwen-Image、Grok Imagine、MiniMax、PixVerse、OmniHuman、Recraft、Topaz、Happyhorse、Infinitalk、ElevenLabs、Gemini TTS、Z-image 等）。

KIE 的所有 Market 生成模型共用同一套 `createTask` / `recordInfo` 契约，因此本插件是一个薄桥接层：模型专属参数原样放在 `input` 中透传，新上线的 Market 模型无需更新插件即可使用。

---

# 中文

## 1. 安装

### 方式 A：第三方插件源（推荐）

把本仓库的 `index.json` 原始地址添加到 New API 管理后台的插件市场（例如发布到 GitHub 后）：

```
https://raw.githubusercontent.com/<owner>/<repo>/main/index.json
```

然后在市场中安装 **KIE.AI**（key: `kie`）。

### 方式 B：手动上传

上传 `plugins/tasks/kie/1.0.1/plugin.js`，图标可选 `plugins/tasks/kie/icon.svg`。

## 2. 绑定渠道

1. 新建渠道，类型选择 **任务插件（Task Plugin，type 61）**。
2. 插件 key 填 `kie`。
3. 密钥填你的 KIE API Key（<https://kie.ai/api-key>）。
4. Base URL 留空即使用默认的 `https://api.kie.ai`。
5. 启用需要的模型（141 个模型均已声明）。

> ⚠️ 渠道页的「测试」按钮对任务插件渠道固定返回 **Task Plugin channel test is not supported**——这是 New API 核心的设计（Midjourney / Suno / Kling / 即梦等所有异步任务渠道都一样），不代表配置有误。验证渠道请直接提交一次真实任务（见下节）。

## 3. 调用方式

### 3.1 原生 KIE 兼容端点（现有 KIE 集成可直接换域名）

```bash
# 提交任务（与 KIE 官方请求体完全一致）
curl -X POST "$NEWAPI/kie/api/v1/jobs/createTask" \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedream-v4-text-to-image",
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
  "model": "kling-3.0/video",
  "prompt": "穿越云层的一镜到底",
  "images": ["https://example.com/ref.jpg"],
  "metadata": { "input": { "duration": 5 } }
}
```

也支持 `multipart/form-data`，但**只接受 URL 字段，不接受文件上传**（见下节）。

## 4. 参考图片 / 视频 / 音频

KIE 只接收 URL：先用 KIE 文件上传 API（`https://kieai.redpandaai.co/api/file-url-upload` 等，免费、24 小时后删除）换取 URL，再把 URL 放进模型文档要求的字段（通用字段名为 `image_urls`），例如：

```json
{ "model": "kling/v3-turbo-image-to-video",
  "input": { "prompt": "缓慢推近", "image_urls": ["https://.../ref.jpg"] } }
```

## 5. 产物与计费

- 产物（图 / 视频 / 音频，含 Seedance 的首帧/尾帧、OmniHuman 抠像 mask）由网关按 artifact 代理转发，KIE 原始链接约 24 小时过期，请及时转存。
- 计费单位 `results` = **实际交付的文件数**；提交时按 `max_images` / `n` / `batch_size` 等参数预占（默认 1，上限 8），完成后按真实数量结算。请在 New API 按 KIE 定价页为各模型配置单文件价格。
- `omnihuman-1-5/human-identification` 为纯文本结果（`resultObject.subject_status`），不计文件数。

## 6. KIE 错误码

| code | 含义 | 插件行为 |
| --- | --- | --- |
| 401 / 403 | 鉴权失败 / 禁止访问 | 任务失败 |
| 402 | 余额不足 | 任务失败 |
| 404 / 422 / 433 / 501 / 505 | 不存在 / 参数 / 子 key 限制 / 生成失败 / 功能关闭 | 任务失败，返回 msg |
| 408 / 429 / 455 / 5xx | 超时 / 限流 / 维护 / 临时错误 | UNKNOWN，由网关继续轮询 |

## 7. 同步对话模型（不在本插件内）

KIE 的 Claude / GPT / Gemini / Grok / Codex 等**同步对话**模型不是异步任务，New API 的任务插件体系不承载它们，请用原生通道接入：

密钥统一填 KIE API Key。共 24 个文字模型、5 个端点：

| 通道类型 | Base URL | 协议 | 模型 |
| --- | --- | --- | --- |
| Anthropic | `https://api.kie.ai/claude` | Messages `/v1/messages` | claude-fable-5、claude-haiku-4-5、claude-opus-4-5/4-6/4-7/4-8/5、claude-sonnet-4-5/4-6/5（10） |
| OpenAI | `https://api.kie.ai/codex` | **Responses** `/v1/responses` | gpt-5-4、gpt-5-5、gpt-5-6-luna/sol/terra、gpt-6-astra、gpt-5-codex、gpt-5.1/5.2/5.3/5.4-codex（11） |
| OpenAI | `https://api.kie.ai/grok` | **Responses** `/v1/responses` | grok-4-3、grok-4-5、grok-4-6 |
| OpenAI | `https://api.kie.ai/gpt-5-2` | Chat `/v1/chat/completions` | gpt-5-2 |
| OpenAI | 每模型一个主机（见下） | Chat `/v1/chat/completions` | Gemini 全系 |

Gemini 主机名与模型同名，按需为常用模型各建一个渠道：
`gemini-2.5-flash`、`gemini-2.5-pro`、`gemini-3-pro`、`gemini-3.1.pro`、`gemini-3-flash` 对应 `https://api.kie.ai/<同名>`；3-5/3-6/3-7/3-8 Flash 用 OpenAI 兼容主机 `https://api.kie.ai/gemini-3-N-flash-openai`（模型名同为 `gemini-3-N-flash-openai`；不带 `-openai` 后缀的是 Google 原生协议）。

注意：codex / grok 两个端点只说 Responses 协议，客户端需调用网关 `/v1/responses`；普通 Chat 客户端请用 gpt-5-2 或 Gemini 渠道。Claude Code 用户可将 `ANTHROPIC_BASE_URL` 指向 `https://api.kie.ai/claude`。具体模型名与可用性以 KIE 文档为准。

## 8. 开发

```bash
python build/build_plugin.py     # 由 build/models.json + 模板生成 plugin.js
node build/smoke-test.mjs        # 离线钩子测试（29 项）
node build/build_index.mjs       # 生成 index.json（meta 派生字段 + sha256）
```

---

# English

A third-party [New API](https://github.com/QuantumNous/new-api) task plugin bridging KIE's unified asynchronous job API. It covers **141 Market generation models** (57 image, 78 video, 5 audio, 1 utility) — Seedream/Seedance, Kling, Wan, Hailuo, Nano Banana, Ideogram, Flux, Imagen, Qwen-Image, Grok Imagine, MiniMax, PixVerse, OmniHuman, Recraft, Topaz, Happyhorse, Infinitalk, ElevenLabs, Gemini TTS and Z-image.

Every KIE Market model shares the same `createTask` / `recordInfo` contract, so the plugin is a thin bridge: model-specific parameters pass through unchanged in `input`, and newly released Market models work without a plugin update.

## Install

- **Third-party marketplace:** add the raw URL of this repository's `index.json` as a plugin source, then install **KIE.AI** (`kie`).
- **Manual:** upload `plugins/tasks/kie/1.0.1/plugin.js` (and optionally `icon.svg`).

## Bind a channel

Create a **Task Plugin** channel (type 61), set `task_plugin_key=kie`, paste your KIE API key (<https://kie.ai/api-key>), and leave Base URL empty to default to `https://api.kie.ai`.

> ⚠️ The channel **Test** button always returns *Task Plugin channel test is not supported* for type-61 channels. This is by design in New API core (same for Midjourney/Suno/Kling/Jimeng and every other async task channel) — it is not a configuration error. Verify the channel by submitting a real task instead.

## Calling the plugin

1. **Native KIE routes** (drop-in replacement): `POST /kie/api/v1/jobs/createTask` and `GET /kie/api/v1/jobs/recordInfo/:taskId`, with the exact KIE request bodies (`model`, `input`, optional `callBackUrl`).
2. **OpenAI Responses** (`POST /v1/responses`, stream/sync/background): send `{model, input}`; standard `input_text`/`input_image` parts map to `prompt`/`image_urls`; extra vendor parameters go under `metadata.input`. Completed files render as proxied `<img>` / `<video>` / `<audio>` tags.
3. **OpenAI Video** (`POST /v1/videos`): `{model, prompt, images?, metadata:{input:{...}}}`; JSON or multipart, URL references only (no file uploads).

Reference media is URL-only on KIE: upload first with the KIE File Upload API (free, deleted after 24h), then pass the URL in the model's documented field (typically `image_urls`).

## Artifacts & billing

- Images, videos and audio — including Seedance first/last frames and OmniHuman masks — are served through gateway-proxied artifacts. Upstream content links expire in roughly 24 hours.
- Billing unit `results` counts delivered files: reserved at submit from `max_images` / `n` / `batch_size` (default 1, capped at 8), settled to the real count on completion. Configure per-file model prices per the KIE pricing page.
- `omnihuman-1-5/human-identification` returns text only (`resultObject.subject_status`) and carries no file charge.
- Permanent envelope errors (401/403/402/404/422/433/501/505) fail the task with the KIE message; transient ones (408/429/455/5xx) map to UNKNOWN and keep polling.

## Synchronous chat models

Chat models are not tasks and cannot live in a task plugin. Bind native channels instead — see the Chinese table above for the Anthropic/OpenAI base URLs (`https://api.kie.ai/claude`, `.../codex`, `.../grok`, per-model `.../<gemini-model>`).
