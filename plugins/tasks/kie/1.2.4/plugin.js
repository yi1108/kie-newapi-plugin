/**
 * KIE.AI — New API task plugin (image / video / audio generation)
 *
 * KIE exposes every Market generation model behind one asynchronous job API:
 *   Base URL   https://api.kie.ai
 *   Auth       Authorization: Bearer <KIE API key>
 *   Submit     POST /api/v1/jobs/createTask
 *              { "model": "<vendor/model>", "callBackUrl"?: "...", "input": { ... } }
 *              -> { "code": 200, "msg": "success", "data": { "taskId": "..." } }
 *   Query      GET  /api/v1/jobs/recordInfo?taskId=<taskId>
 *              data.state: waiting | queuing | generating | success | fail
 *              data.resultJson (a JSON string, present on success):
 *                { "resultUrls": ["https://..."] }                    // images / videos / audio
 *                { "resultUrls": [], "firstFrameUrl": [], "lastFrameUrl": [] } // Seedance frames
 *                { "resultObject": { ... } }                          // text / masks / status
 *
 * Because the upstream contract is already uniform, this plugin is a thin,
 * generic bridge: it forwards the vendor `input` object verbatim and interprets
 * the shared result envelope. One code path therefore covers every current and
 * future KIE Market model without per-model request shaping. Model-specific
 * parameters travel unchanged in `input`; reference images/videos are passed as
 * URLs in the model's documented input fields (for example `image_urls`).
 *
 * KIE's synchronous chat models (Claude, GPT, Gemini, Grok, Codex) are not
 * tasks and are not declared here; drive them with a native Anthropic / OpenAI
 * channel. See README.md for the endpoint table.
 *
 * Bind a Task Plugin channel with task_plugin_key=kie and leave Base URL empty
 * to use https://api.kie.ai.
 */

export const meta = {
  apiVersion: 1,
  key: "kie",
  name: "KIE.AI",
  icon: "text",
  sortPriority: 50,
  description: {
    en: "KIE.AI image, video and audio generation (Seedream, Kling, Wan, Seedance, Hailuo, Nano Banana, Ideogram, ElevenLabs and more)",
    zh: "KIE.AI 图像、视频与音频生成（即梦 Seedream、可灵 Kling、通义万相 Wan、Seedance、海螺、Nano Banana、Ideogram、ElevenLabs 等）",
  },
  version: "1.2.4",
  author: { name: "community", url: "https://kie.ai" },
  website: "https://kie.ai",
  baseUrl: "https://api.kie.ai",
  models: [
    "4o-image-api",
    "bytedance/seedance-v1",
    "elevenlabs-tts",
    "elevenlabs/text-to-dialogue-v3",
    "elevenlabs/text-to-speech-multilingual-v2",
    "features/v3-api",
    "flux-2",
    "flux-kontext-api",
    "gemini-2.5-pro-preview-tts",
    "gemini-3.1-flash-tts",
    "gemini-omni",
    "gemini-omni-1-1-flash",
    "google/imagen4",
    "gpt-image-1.5",
    "gpt-image-2",
    "gpt-image-2-5",
    "grok-imagine",
    "grok-imagine-image-2",
    "grok-imagine-video-1.5",
    "hailuo-2-3",
    "hailuo-api",
    "happyhorse-1-0",
    "happyhorse-1-1",
    "ideogram/character",
    "ideogram/v3",
    "infinitalk",
    "kling-2-5",
    "kling-2-6",
    "kling-2.6-motion-control",
    "kling-3-0",
    "kling-3-0-turbo",
    "kling-3-motion-control",
    "kling-ai-avatar",
    "kling-o3",
    "kling/v2-1",
    "minimax-h3",
    "nano-banana",
    "nano-banana-2",
    "nano-banana-2-lite",
    "nano-banana-pro",
    "omnihuman-1-5",
    "pixverse-v6",
    "qwen-image",
    "qwen-image-2",
    "qwen-image-3",
    "qwen/image-edit",
    "recraft-crisp-upscale",
    "recraft-remove-background",
    "runway-api",
    "seedance-1-0-pro-fast",
    "seedance-1-5-pro",
    "seedance-2-0",
    "seedance-2-0-mini",
    "seedance-2-5",
    "seedream",
    "seedream-4-5",
    "seedream-5-0-pro",
    "seedream-api",
    "seedream5-0-lite",
    "suno-api",
    "topaz-image-upscale",
    "topaz-video-upscaler",
    "veo-3-1",
    "volcengine-video-to-video-lip-sync",
    "wan-2-5",
    "wan-2-6",
    "wan-2-7-image",
    "wan-2-7-video",
    "wan-animate",
    "wan-speech-to-video-turbo",
    "wan/v2-2",
    "wan3.0-video",
    "wan3.0-video-prime",
    "z-image",
  ],
  fetchMode: "per_task",
  auth: "api_key",
  usageSchema: {
    results: {
      type: "number",
      unit: "count",
      description: { en: "Generated image/audio/tool file unit price", zh: "图像、音频与工具文件单价" },
    },
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
    resolution: {
      enum: ["none", "360p", "480p", "512p", "540p", "720p", "768p", "1080p", "2k", "4k"],
      enumLabels: {
        none: { en: "None", zh: "无" },
        "360p": { en: "360p", zh: "360p" },
        "480p": { en: "480p", zh: "480p" },
        "512p": { en: "512P", zh: "512P" },
        "540p": { en: "540p", zh: "540p" },
        "720p": { en: "720p", zh: "720p" },
        "768p": { en: "768P", zh: "768P" },
        "1080p": { en: "1080p", zh: "1080p" },
        "2k": { en: "2K", zh: "2K" },
        "4k": { en: "4K", zh: "4K" },
      },
      description: { en: "Output video resolution", zh: "输出视频分辨率" },
    },
    tier: {
      enum: ["none", "standard", "lite", "fast", "turbo", "pro", "master", "ultra"],
      enumLabels: {
        none: { en: "None", zh: "无" },
        standard: { en: "Standard", zh: "标准" },
        lite: { en: "Lite", zh: "Lite" },
        fast: { en: "Fast", zh: "Fast" },
        turbo: { en: "Turbo", zh: "Turbo" },
        pro: { en: "Pro", zh: "Pro" },
        master: { en: "Master", zh: "Master" },
        ultra: { en: "Ultra", zh: "Ultra" },
      },
      description: { en: "Product tier", zh: "产品档位" },
    },
    generate_audio: {
      type: "boolean",
      description: { en: "Whether audio is generated", zh: "是否生成音频" },
    },
    input_images: {
      type: "number",
      unit: "count",
      description: { en: "Input image unit price", zh: "输入图片单价" },
    },
    input_video_seconds: {
      type: "number",
      unit: "second",
      description: { en: "Input video unit price", zh: "输入视频单价" },
    },
    audio_characters: {
      type: "number",
      unit: "token",
      description: { en: "Speech text character unit price", zh: "语音文本字符单价" },
    },
  },
  usageExamples: [
    { label: "1 image", facts: { results: 1, seconds: 0, resolution: "none", tier: "none", generate_audio: false, input_images: 0, input_video_seconds: 0, audio_characters: 0 } },
    { label: "4 images", facts: { results: 4, seconds: 0, resolution: "none", tier: "none", generate_audio: false, input_images: 0, input_video_seconds: 0, audio_characters: 0 } },
    { label: "720p standard 5s", facts: { results: 0, seconds: 5, resolution: "720p", tier: "standard", generate_audio: false, input_images: 0, input_video_seconds: 0, audio_characters: 0 } },
    { label: "1080p pro 5s audio", facts: { results: 0, seconds: 5, resolution: "1080p", tier: "pro", generate_audio: true, input_images: 0, input_video_seconds: 0, audio_characters: 0 } },
    { label: "4K 10s", facts: { results: 0, seconds: 10, resolution: "4k", tier: "ultra", generate_audio: false, input_images: 0, input_video_seconds: 0, audio_characters: 0 } },
    { label: "TTS 500 characters", facts: { results: 1, seconds: 0, resolution: "none", tier: "none", generate_audio: false, input_images: 0, input_video_seconds: 0, audio_characters: 500 } },
  ],
  routes: [
    { method: "POST", path: "/kie/api/v1/jobs/createTask", type: "submit", decode: "createJob", render: "jobCreated" },
    { method: "GET", path: "/kie/api/v1/jobs/recordInfo/:taskId", type: "query", taskIdParam: "taskId", render: "jobStatus" },
  ],
  protocols: [
    { name: "openai_responses", supports: ["stream", "sync", "background"] },
    "openai_video",

  ],
};

// --- model catalog -----------------------------------------------------------
// Generated from the KIE Market documentation. IMAGE/AUDIO/UTILITY are explicit
// sets; every other declared model is treated as video, which is also the
// fallback media class for extension-less temporary URLs.

const PRODUCT_UPSTREAM_MODELS = {
    "4o-image-api": "4o-image-api",
    "bytedance/seedance-v1": "bytedance/v1-pro-text-to-video",
    "elevenlabs-tts": "elevenlabs/text-to-speech-turbo-2-5",
    "elevenlabs/text-to-dialogue-v3": "elevenlabs/text-to-dialogue-v3",
    "elevenlabs/text-to-speech-multilingual-v2": "elevenlabs/text-to-speech-multilingual-v2",
    "features/v3-api": "v3-api",
    "flux-2": "flux-2/flex-text-to-image",
    "flux-kontext-api": "flux1-kontext",
    "gemini-2.5-pro-preview-tts": "google/gemini-2-5-pro-tts",
    "gemini-3.1-flash-tts": "google/gemini-3-1-flash-tts",
    "gemini-omni": "gemini-omni-video",
    "gemini-omni-1-1-flash": "google/gemini-omni-flash-1-1",
    "google/imagen4": "google/imagen4",
    "gpt-image-1.5": "gpt-image/1.5-text-to-image",
    "gpt-image-2": "gpt-image-2-text-to-image",
    "gpt-image-2-5": "gpt-image-2-5-sunburst-text-to-image",
    "grok-imagine": "grok-imagine/text-to-video",
    "grok-imagine-image-2": "grok-imagine-image-2-0/text-to-image",
    "grok-imagine-video-1.5": "grok-imagine-video-1-5-preview",
    "hailuo-2-3": "hailuo/2-3-image-to-video-standard",
    "hailuo-api": "hailuo/02-text-to-video-standard",
    "happyhorse-1-0": "happyhorse/text-to-video",
    "happyhorse-1-1": "happyhorse-1-1/text-to-video",
    "ideogram/character": "ideogram/character",
    "ideogram/v3": "ideogram/v3-text-to-image",
    "infinitalk": "infinitalk/from-audio",
    "kling-2-5": "kling/v2-5-turbo-text-to-video-pro",
    "kling-2-6": "kling-2.6/text-to-video",
    "kling-2.6-motion-control": "kling-2.6/motion-control",
    "kling-3-0": "kling-3.0/video",
    "kling-3-0-turbo": "kling/v3-turbo-text-to-video",
    "kling-3-motion-control": "kling-3.0/motion-control",
    "kling-ai-avatar": "kling/v1-avatar-standard",
    "kling-o3": "kling-3.0-omni/text-to-video",
    "kling/v2-1": "kling/v2-1-standard",
    "minimax-h3": "minimax-h3/text-to-video",
    "nano-banana": "google/nano-banana",
    "nano-banana-2": "nano-banana-2",
    "nano-banana-2-lite": "nano-banana-2-lite",
    "nano-banana-pro": "nano-banana-pro",
    "omnihuman-1-5": "omnihuman-1-5",
    "pixverse-v6": "pixverse-v6/text-to-video",
    "qwen-image": "qwen/text-to-image",
    "qwen-image-2": "qwen2/text-to-image",
    "qwen-image-3": "qwen3/text-to-image",
    "qwen/image-edit": "qwen/image-edit",
    "recraft-crisp-upscale": "recraft/crisp-upscale",
    "recraft-remove-background": "recraft/remove-background",
    "runway-api": "runway",
    "seedance-1-0-pro-fast": "bytedance/v1-pro-fast-image-to-video",
    "seedance-1-5-pro": "bytedance/seedance-1.5-pro",
    "seedance-2-0": "bytedance/seedance-2",
    "seedance-2-0-mini": "bytedance/seedance-2-mini",
    "seedance-2-5": "bytedance/seedance-2-5",
    "seedream": "bytedance/seedream",
    "seedream-4-5": "seedream/4.5-text-to-image",
    "seedream-5-0-pro": "seedream/5-pro-text-to-image",
    "seedream-api": "bytedance/seedream-v4-text-to-image",
    "seedream5-0-lite": "seedream/5-lite-text-to-image",
    "suno-api": "ai-music-api/generate",
    "topaz-image-upscale": "topaz/image-upscale",
    "topaz-video-upscaler": "topaz/video-upscale",
    "veo-3-1": "veo-3-1",
    "volcengine-video-to-video-lip-sync": "volcengine/video-to-video-lip-sync",
    "wan-2-5": "wan/2-5-text-to-video",
    "wan-2-6": "wan/2-6-text-to-video",
    "wan-2-7-image": "wan/2-7-image",
    "wan-2-7-video": "wan/2-7-text-to-video",
    "wan-animate": "wan/2-2-animate-move",
    "wan-speech-to-video-turbo": "wan/2-2-a14b-speech-to-video-turbo",
    "wan/v2-2": "wan/2-2-a14b-text-to-video-turbo",
    "wan3.0-video": "wan/3-0-video",
    "wan3.0-video-prime": "wan/3-0-video-prime",
    "z-image": "z-image",
  };
const IMAGE_MODELS = new Set([
    "4o-image-api",
    "bytedance/seedream",
    "bytedance/seedream-v4-text-to-image",
    "flux-2/flex-text-to-image",
    "flux1-kontext",
    "google/imagen4",
    "google/nano-banana",
    "gpt-image-2-5-sunburst-text-to-image",
    "gpt-image-2-text-to-image",
    "gpt-image/1.5-text-to-image",
    "grok-imagine-image-2-0/text-to-image",
    "ideogram/character",
    "ideogram/v3-text-to-image",
    "nano-banana-2",
    "nano-banana-2-lite",
    "nano-banana-pro",
    "qwen/image-edit",
    "qwen/text-to-image",
    "qwen2/text-to-image",
    "qwen3/text-to-image",
    "recraft/crisp-upscale",
    "recraft/remove-background",
    "seedream/4.5-text-to-image",
    "seedream/5-lite-text-to-image",
    "seedream/5-pro-text-to-image",
    "topaz/image-upscale",
    "wan/2-7-image",
    "z-image",
  ]);
const AUDIO_MODELS = new Set([
    "ai-music-api/generate",
    "elevenlabs/text-to-dialogue-v3",
    "elevenlabs/text-to-speech-multilingual-v2",
    "elevenlabs/text-to-speech-turbo-2-5",
    "google/gemini-2-5-pro-tts",
    "google/gemini-3-1-flash-tts",
  ]);
const UTILITY_MODELS = new Set([]);
const IMAGE_PRODUCT_MODELS = new Set([
    "4o-image-api",
    "flux-2",
    "flux-kontext-api",
    "google/imagen4",
    "gpt-image-1.5",
    "gpt-image-2",
    "gpt-image-2-5",
    "grok-imagine-image-2",
    "ideogram/character",
    "ideogram/v3",
    "nano-banana",
    "nano-banana-2",
    "nano-banana-2-lite",
    "nano-banana-pro",
    "qwen-image",
    "qwen-image-2",
    "qwen-image-3",
    "qwen/image-edit",
    "recraft-crisp-upscale",
    "recraft-remove-background",
    "seedream",
    "seedream-4-5",
    "seedream-5-0-pro",
    "seedream-api",
    "seedream5-0-lite",
    "topaz-image-upscale",
    "wan-2-7-image",
    "z-image",
  ]);

const JOBS_PATH = "/api/v1/jobs/createTask";
const RECORD_PATH = "/api/v1/jobs/recordInfo";
const USER_AGENT = "kie-newapi-plugin/1.2.4";
const DEFAULT_ELEVENLABS_VOICE = "N2lVS1w4EtoT3dr4eOWO";
// KIE rejects tasks that produce more than a handful of files; cap the estimate.
const MAX_ESTIMATED_RESULTS = 8;
const URL_RE = /^https?:\/\/[^\s"']+$/i;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function trimmed(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function authHeaders(ctx, withJson) {
  const headers = { Accept: "application/json", Authorization: "Bearer " + (ctx.apiKey || ""), "User-Agent": USER_AGENT };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

function categoryOf(model) {
  if (IMAGE_MODELS.has(model) || IMAGE_PRODUCT_MODELS.has(model)) return "image";
  if (AUDIO_MODELS.has(model)) return "audio";
  if (UTILITY_MODELS.has(model)) return "utility";
  return "video";
}

// Heuristic used only for the display `action`: does the request reference any
// source media (image / frame / video / audio), making it an edit or i2v job?
const REFERENCE_KEY_RE = /image|frame|video|audio|media|reference|mask|photo|picture/i;

// KIE source media is always passed as URLs (upload first, then pass the
// returned URL), so a non-empty string that is not a URL — or a number such as
// max_images — never counts as a reference.
function hasReferenceValue(value) {
  if (typeof value === "string") return URL_RE.test(value.trim());
  if (Array.isArray(value)) return value.some(hasReferenceValue);
  if (isPlainObject(value)) return Object.keys(value).some(function (key) { return hasReferenceValue(value[key]); });
  return false;
}

function hasReferenceInput(input) {
  return Object.keys(input).some(function (key) {
    return REFERENCE_KEY_RE.test(key) && hasReferenceValue(input[key]);
  });
}

function actionFor(model, input) {
  const category = categoryOf(model);
  if (category === "audio") return "audio";
  if (category === "utility") return "utility";
  if (category === "image") return hasReferenceInput(input) ? "image_edit" : "text_to_image";
  return hasReferenceInput(input) ? "image_to_video" : "text_to_video";
}

// Positive integer used to reserve quota at submit time; settled against the
// real file count on completion for non-video models.
function estimateResults(input) {
  for (const key of ["max_images", "num_images", "num_outputs", "n", "batch_size", "batch"]) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== "") {
      const value = Number(input[key]);
      if (Number.isInteger(value) && value > 0) return Math.min(value, MAX_ESTIMATED_RESULTS);
    }
  }
  return 1;
}

const DEFAULT_VIDEO_SECONDS = 5;
const MAX_ESTIMATED_VIDEO_SECONDS = 300;
const DEFAULT_INPUT_VIDEO_SECONDS = 15;

function firstPresent(input, keys) {
  for (const key of keys) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== "") return input[key];
  }
  return undefined;
}

function estimateSecondsValue(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (Number(value) === -1) return maximum;
  if (Array.isArray(value)) {
    const sum = value.reduce(function (total, item) {
      return total + estimateSecondsValue(item, 0, maximum);
    }, 0);
    return sum > 0 ? Math.min(sum, maximum) : fallback;
  }
  if (isPlainObject(value)) {
    const nested = firstPresent(value, ["duration", "seconds", "duration_seconds", "length"]);
    return estimateSecondsValue(nested, fallback, maximum);
  }
  const match = String(value).match(/\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const seconds = Number(match[0]);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(seconds, maximum);
}

function estimateVideoSeconds(model, input) {
  if (Array.isArray(input.multi_prompt)) {
    const total = input.multi_prompt.reduce(function (seconds, shot) {
      return seconds + estimateSecondsValue(shot, 0, MAX_ESTIMATED_VIDEO_SECONDS);
    }, 0);
    if (total > 0) return Math.min(total, MAX_ESTIMATED_VIDEO_SECONDS);
  }
  const value = firstPresent(input, ["duration", "video_duration", "clip_duration", "seconds", "length"]);
  if (value !== undefined) return estimateSecondsValue(value, DEFAULT_VIDEO_SECONDS, MAX_ESTIMATED_VIDEO_SECONDS);
  if (/^hailuo\//.test(model)) return 6;
  return DEFAULT_VIDEO_SECONDS;
}

function resolutionCandidate(input) {
  const direct = firstPresent(input, ["resolution", "video_resolution", "output_resolution", "quality", "mode", "size", "scale"]);
  if (direct !== undefined) return String(direct).toLowerCase();
  const width = Number(firstPresent(input, ["width", "w"]));
  const height = Number(firstPresent(input, ["height", "h"]));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return String(Math.max(width, height));
  return "";
}

function normalizeResolution(model, input) {
  const mode = trimmed(input.mode).toLowerCase();
  if (mode === "std" || mode === "standard") return "720p";
  if (mode === "pro") return "1080p";
  if (mode === "4k" || mode === "uhd") return "4k";

  const value = resolutionCandidate(input);
  const numeric = value.match(/\d{3,4}/g) || [];
  const maxDimension = numeric.reduce(function (max, item) { return Math.max(max, Number(item)); }, 0);
  if (/\b(4k|uhd|2160p?)\b/i.test(value) || maxDimension >= 2160) return "4k";
  if (/\b(2k|1440p?)\b/i.test(value) || maxDimension >= 1440) return "2k";
  if (/\b(1080p?|fhd|full[ _-]?hd)\b/i.test(value) || maxDimension >= 1080) return "1080p";
  if (/\b(768p?)\b/i.test(value) || maxDimension >= 768) return "768p";
  if (/\b(720p?|hd)\b/i.test(value) || maxDimension >= 720) return "720p";
  if (/\b(540p?)\b/i.test(value) || maxDimension >= 540) return "540p";
  if (/\b(512p?)\b/i.test(value) || maxDimension >= 512) return "512p";
  if (/\b(480p?|sd)\b/i.test(value) || maxDimension >= 480) return "480p";
  if (/\b(360p?)\b/i.test(value) || maxDimension >= 360) return "360p";

  if (/^wan\/3-0-video/.test(model)) return "1080p";
  if (/^hailuo\//.test(model) || /^minimax-h3\//.test(model)) return "768p";
  return "720p";
}

function normalizeTier(model, input) {
  const raw = (trimmed(input.mode) || trimmed(input.tier) || trimmed(input.quality) || model).toLowerCase();
  if (/\bmaster\b/.test(raw)) return "master";
  if (/\bultra\b|\b4k\b/.test(raw)) return "ultra";
  if (/\bpro\b/.test(raw)) return "pro";
  if (/\bturbo\b/.test(raw)) return "turbo";
  if (/\bfast\b/.test(raw)) return "fast";
  if (/\blite\b|\bmini\b/.test(raw)) return "lite";
  return "standard";
}

function truthyMediaAudio(model, input) {
  const raw = firstPresent(input, ["generate_audio", "audio", "sound", "with_audio"]);
  if (raw !== undefined) return raw === true || String(raw).toLowerCase() === "true" || String(raw) === "1";
  if (/^wan\/3-0-video/.test(model)) return true;
  if (/^kling-3\.0\//.test(model) && input.multi_shots === true) return true;
  return false;
}

function countUrlsByKey(input, pattern) {
  let count = 0;
  const visit = function (value, key) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) return value.forEach(function (item) { return visit(item, key); });
    if (isPlainObject(value)) {
      Object.keys(value).forEach(function (childKey) { return visit(value[childKey], childKey); });
      return;
    }
    if (pattern.test(String(key || "")) && URL_RE.test(trimmed(value))) count++;
  };
  Object.keys(input).forEach(function (key) { return visit(input[key], key); });
  return count;
}

function inputVideoSeconds(input) {
  const explicit = firstPresent(input, ["input_video_seconds", "reference_video_seconds", "source_video_seconds"]);
  if (explicit !== undefined) return estimateSecondsValue(explicit, 0, MAX_ESTIMATED_VIDEO_SECONDS);
  const hasVideoUrl = countUrlsByKey(input, /video/i) > 0;
  return hasVideoUrl ? DEFAULT_INPUT_VIDEO_SECONDS : 0;
}

function videoUsage(model, input) {
  return {
    seconds: estimateVideoSeconds(model, input),
    resolution: normalizeResolution(model, input),
    tier: normalizeTier(model, input),
    generate_audio: truthyMediaAudio(model, input),
    input_images: countUrlsByKey(input, /image|frame|photo|picture/i),
    input_video_seconds: inputVideoSeconds(input),
  };
}

function usageFor(model, input) {
  if (categoryOf(model) === "video") return videoUsage(model, input);
  if (categoryOf(model) === "audio") return audioUsage(model, input);
  return { results: estimateResults(input) };
}

function audioText(input) {
  const value = firstPresent(input, ["text", "prompt", "script", "dialogue"]);
  let text;
  if (Array.isArray(value)) text = value.map(function (item) {
    if (typeof item === "string") return item;
    if (isPlainObject(item)) return trimmed(item.text || item.content || item.message);
    return "";
  }).join("\n");
  else text = trimmed(value);
  // Gemini TTS carries spoken text in dialogue_turns rather than a top-level field.
  if (Array.isArray(input.dialogue_turns)) {
    const turns = input.dialogue_turns.map(function (item) {
      return isPlainObject(item) ? trimmed(item.text) : "";
    }).filter(Boolean).join("\n");
    if (turns) text = text ? text + "\n" + turns : turns;
  }
  return text;
}

function audioUsage(model, input) {
  const text = audioText(input);
  const usage = { results: estimateResults(input), tier: normalizeTier(model, input) };
  if (text) usage.audio_characters = Array.from(text).length;
  return usage;
}

// ---------------------------------------------------------------------------
// Request normalization (shared by the native route and both host protocols)
// ---------------------------------------------------------------------------

function normalizeInput(value) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new Error("input must be an object");
  // Shallow-clone so driver hooks never mutate the host-parsed request body.
  return Object.assign({}, value);
}

function normalizeCallback(value) {
  if (value === undefined || value === null) return "";
  const url = trimmed(value);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) throw new Error("callBackUrl must be an absolute http(s) URL");
  return url;
}

const GEMINI_TTS_MODELS = new Set([
  "google/gemini-2-5-pro-tts",
  "google/gemini-3-1-flash-tts",
]);

const ELEVENLABS_TTS_MODELS = new Set([
  "elevenlabs/text-to-speech-turbo-2-5",
  "elevenlabs/text-to-speech-multilingual-v2",
]);

const ELEVENLABS_DIALOGUE_MODELS = new Set([
  "elevenlabs/text-to-dialogue-v3",
]);

// elevenlabs-tts defaults to turbo 2.5; an explicit "standard" tier selects
// multilingual v2 (its sell price equals the standard tier expression).
function routeAudioModel(model, input) {
  if (model === "elevenlabs/text-to-speech-turbo-2-5" && normalizeTier(model, input) === "standard") {
    return "elevenlabs/text-to-speech-multilingual-v2";
  }
  return model;
}

// Fill Gemini TTS speaker configuration from a plain prompt so the models work
// through both host protocols without clients hand-building dialogue payloads.
function normalizeAudioInput(model, input) {
  if (ELEVENLABS_TTS_MODELS.has(model)) {
    const out = Object.assign({}, input);
    if (!trimmed(out.text)) {
      const text = trimmed(firstPresent(out, ["prompt", "script"]));
      if (text) out.text = text;
    }
    const voice = trimmed(firstPresent(out, ["voice", "voiceId", "voice_id"]));
    if (voice) out.voice = voice;
    else out.voice = DEFAULT_ELEVENLABS_VOICE;
    delete out.voiceId;
    delete out.voice_id;
    return out;
  }
  if (ELEVENLABS_DIALOGUE_MODELS.has(model)) {
    const out = Object.assign({}, input);
    let dialogue = Array.isArray(out.dialogue) ? out.dialogue : [];
    if (!dialogue.length) {
      const text = trimmed(firstPresent(out, ["text", "prompt", "script"]));
      if (text) dialogue = [text];
    }
    if (!dialogue.length) return input; // let upstream run its own validation
    const defaultVoice = trimmed(firstPresent(out, ["voice", "voiceId", "voice_id"])) || DEFAULT_ELEVENLABS_VOICE;
    out.dialogue = dialogue.map(function (item) {
      if (typeof item === "string") return { text: item, voice: defaultVoice };
      if (!isPlainObject(item)) return item;
      const text = trimmed(item.text || item.content || item.message);
      const voice = trimmed(firstPresent(item, ["voice", "voiceId", "voice_id"])) || defaultVoice;
      const normalized = Object.assign({}, item, { text: text, voice: voice });
      delete normalized.voiceId;
      delete normalized.voice_id;
      return normalized;
    }).filter(function (item) {
      return isPlainObject(item) && trimmed(item.text);
    });
    if (!out.dialogue.length) return input;
    out.voice = defaultVoice;
    delete out.voiceId;
    delete out.voice_id;
    return out;
  }
  if (!GEMINI_TTS_MODELS.has(model)) return input;
  const turns = [];
  if (Array.isArray(input.dialogue_turns)) {
    input.dialogue_turns.forEach(function (item, index) {
      if (!isPlainObject(item)) return;
      const text = trimmed(item.text);
      if (!text) return;
      turns.push({ speaker_id: trimmed(item.speaker_id) || ("Speaker " + (index + 1)), text: text });
    });
  }
  if (!turns.length) {
    const text = trimmed(firstPresent(input, ["text", "prompt", "script"]));
    if (text) turns.push({ speaker_id: "Speaker 1", text: text });
  }
  if (!turns.length) return input; // let upstream run its own validation
  const out = Object.assign({}, input, { dialogue_turns: turns });
  if (!Array.isArray(out.speakers) || !out.speakers.length) {
    const used = {};
    turns.forEach(function (turn) { used[turn.speaker_id] = 1; });
    out.speakers = Object.keys(used).map(function (id) {
      return { speaker_id: id, voice_name: "Zephyr", accent: "Neutral" };
    });
  } else {
    out.speakers = out.speakers.map(function (speaker, index) {
      if (!isPlainObject(speaker)) return speaker;
      const normalized = Object.assign({}, speaker);
      if (!trimmed(normalized.speaker_id)) normalized.speaker_id = "Speaker " + (index + 1);
      if (!trimmed(normalized.voice_name)) normalized.voice_name = "Zephyr";
      if (!trimmed(normalized.accent)) normalized.accent = "Neutral";
      return normalized;
    });
  }
  return out;
}

// Resolve the vendor model id. A channel mapping is authoritative; without one
// the client already sends the public KIE model id.
function resolveModel(ctx, fallback) {
  const clientModel = trimmed(ctx.model);
  const upstreamModel = trimmed(ctx.upstreamModel);
  const mapped = upstreamModel && upstreamModel !== clientModel ? upstreamModel : "";
  const model = mapped || PRODUCT_UPSTREAM_MODELS[clientModel] || trimmed(fallback) || clientModel;
  if (!model) throw new Error("model is required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(model)) throw new Error("model is not a valid KIE model id: " + model);
  return model;
}

// Produces the canonical {model, input, callBackUrl?} KIE createTask payload.
function normalizeJob(ctx, value, modelFallback) {
  if (!isPlainObject(value)) throw new Error("request body must be a JSON object");
  const resolvedModel = resolveModel(ctx, modelFallback !== undefined ? modelFallback : value.model);
  const rawInput = normalizeInput(value.input);
  const model = routeAudioModel(resolvedModel, rawInput);
  const input = normalizeAudioInput(model, rawInput);
  const job = { model: model, input: input };
  const callBackUrl = normalizeCallback(value.callBackUrl);
  if (callBackUrl) job.callBackUrl = callBackUrl;
  return job;
}

// ---------------------------------------------------------------------------
// Upstream record / result parsing
// ---------------------------------------------------------------------------

function recordData(body) {
  if (isPlainObject(body) && isPlainObject(body.data)) return body.data;
  return null;
}

function safeParseJson(value) {
  if (value === undefined || value === null || value === "") return null;
  if (isPlainObject(value) || Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

function looksLikeUrl(value) {
  return typeof value === "string" && URL_RE.test(value.trim());
}

function pushUrl(list, value, role) {
  const url = trimmed(value);
  if (url && URL_RE.test(url) && !list.some(function (item) { return item.url === url; })) list.push({ url: url, role: role });
}

// Walk a resultObject and surface any URL arrays/strings (e.g. mask_urls). The
// key decides the media hint; unknown URLs keep the model-category fallback.
function collectObjectUrls(obj, list, depth) {
  if (depth > 6 || obj === null || obj === undefined) return;
  if (typeof obj === "string") {
    if (looksLikeUrl(obj)) pushUrl(list, obj, "object");
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach(function (item) { collectObjectUrls(item, list, depth + 1); });
    return;
  }
  if (isPlainObject(obj)) {
    Object.keys(obj).forEach(function (key) {
      const value = obj[key];
      if (/mask/i.test(key) && Array.isArray(value)) value.forEach(function (u) { return pushUrl(list, u, "object_image"); });
      else collectObjectUrls(value, list, depth + 1);
    });
  }
}

// Returns {primary:[{url,role}], frames:[...], object:[...], resultObject}.
function parseRecord(data) {
  const out = { primary: [], frames: [], object: [], resultObject: null };
  const parsed = safeParseData(data);
  if (!isPlainObject(parsed)) return out;
  const primary = Array.isArray(parsed.resultUrls) ? parsed.resultUrls : [];
  primary.forEach(function (url) { pushUrl(out.primary, url, "primary"); });
  ["firstFrameUrl", "lastFrameUrl"].forEach(function (key) {
    const value = parsed[key];
    (Array.isArray(value) ? value : []).forEach(function (url) { pushUrl(out.frames, url, "frame"); });
  });
  if (parsed.resultObject !== undefined && parsed.resultObject !== null) out.resultObject = parsed.resultObject;
  collectObjectUrls(parsed.resultObject, out.object, 0);
  // Suno (and other audio products) return { data: [{ audio_url, image_url }] }.
  if (parsed.data !== undefined && parsed.data !== null) collectObjectUrls(parsed.data, out.object, 0);
  return out;
}

function safeParseData(data) {
  return safeParseJson(data ? data.resultJson : null);
}

const STATE_TO_STATUS = { waiting: "QUEUED", queuing: "QUEUED", queued: "QUEUED", generating: "IN_PROGRESS", processing: "IN_PROGRESS", running: "IN_PROGRESS", success: "SUCCESS", succeed: "SUCCESS", done: "SUCCESS", fail: "FAILURE", failed: "FAILURE", error: "FAILURE" };

function progressPercent(data, status) {
  const raw = Number(data && data.progress);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 100) return String(Math.round(raw)) + "%";
  if (status === "SUCCESS") return "100%";
  if (status === "IN_PROGRESS") return "50%";
  if (status === "QUEUED") return "0%";
  return "";
}

const IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml" };

function imageMimeFor(url) {
  const ext = url.split("?")[0].replace(/#.*$/, "").toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(ext);
  return match && IMAGE_MIME[match[1]] ? IMAGE_MIME[match[1]] : "";
}

// Assign stable, positional artifact keys. listArtifacts and buildContentRequest
// both rebuild this ordering, so a key always resolves to the same URL.
function artifactEntries(data, model) {
  const category = categoryOf(model);
  const parsed = parseRecord(data);
  const entries = [];
  const counts = { image: 0, video: 0, audio: 0 };

  function typeFor(url, role) {
    if (role === "frame" || role === "object_image") return "image";
    const ext = url.split("?")[0].replace(/#.*$/, "").toLowerCase();
    if (/\.(mp4|webm|mov|mkv|avi|m4v|m3u8)$/.test(ext)) return "video";
    if (/\.(mp3|wav|ogg|oga|m4a|aac|flac)$/.test(ext)) return "audio";
    if (/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(ext)) return "image";
    if (category === "audio") return "audio";
    if (category === "image" || category === "utility") return "image";
    return "video";
  }

  function add(url, role) {
    const type = typeFor(url, role);
    const key = type + "-" + counts[type]++;
    const entry = { key: key, type: type, url: url, role: role };
    if (type === "image") {
      const mime = imageMimeFor(url);
      if (mime) entry.mimeType = mime;
    }
    entries.push(entry);
  }

  parsed.primary.forEach(function (item) { add(item.url, item.role); });
  parsed.frames.forEach(function (item) { add(item.url, item.role); });
  parsed.object.forEach(function (item) { add(item.url, item.role); });
  return entries;
}

function envelopeError(body) {
  if (!isPlainObject(body)) return "";
  if (body.code === undefined || body.code === null || Number(body.code) === 200) return "";
  return trimmed(body.msg) || ("upstream error " + body.code);
}

// ---------------------------------------------------------------------------
// Submit / query driver hooks
// ---------------------------------------------------------------------------

export function buildSubmitRequest(ctx) {
  const job = normalizeJob(ctx, ctx.requestBody, (ctx.requestBody || {}).model);
  return {
    url: ctx.baseUrl + JOBS_PATH,
    method: "POST",
    headers: authHeaders(ctx, true),
    body: job,
    action: actionFor(job.model, job.input),
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = (resp && resp.body) || {};
  const upstreamError = envelopeError(body);
  if (upstreamError) throw new Error(upstreamError);
  if (resp && Number(resp.statusCode) >= 400) throw new Error("KIE createTask failed with HTTP " + resp.statusCode);
  const data = recordData(body);
  const taskId = trimmed(data && data.taskId);
  if (!taskId) throw new Error("upstream response did not include a task id");
  return { taskId: taskId, taskData: body };
}

export function buildQueryRequest(ctx) {
  const taskId = trimmed(ctx.taskId);
  if (!taskId) throw new Error("taskId is empty");
  return {
    url: ctx.baseUrl + RECORD_PATH + "?taskId=" + encodeURIComponent(taskId),
    method: "GET",
    headers: authHeaders(ctx, false),
  };
}

// KIE envelope codes seen when no task state is present. Permanent failures end
// the task; transient ones return UNKNOWN so the host keeps polling.
const HARD_CODES = { 401: 1, 402: 1, 403: 1, 404: 1, 422: 1, 433: 1, 501: 1, 505: 1 };

function envelopeState(body, data) {
  if (data && trimmed(data.state)) return "";
  if (!isPlainObject(body) || body.code === undefined || Number(body.code) === 200) return "";
  const code = Number(body.code);
  const message = trimmed(body.msg) || ("upstream error " + code);
  return HARD_CODES[code]
    ? { status: "FAILURE", reason: message }
    : { status: "UNKNOWN", reason: "Transient KIE error: " + message };
}

export function parseTaskResult(ctx, body) {
  const data = recordData(body);
  // Classify the envelope first: documented error bodies carry data:null,
  // which must still terminate permanently on hard codes instead of polling.
  const fallback = envelopeState(body, data);
  if (fallback) return fallback;
  if (!data) return { status: "UNKNOWN", reason: "Unrecognized KIE record response" };

  const state = trimmed(data.state).toLowerCase();
  if (state === "fail" || state === "failed" || state === "error") {
    const failMsg = trimmed(data.failMsg);
    const failCode = trimmed(data.failCode);
    const reason = failMsg || (failCode ? "task failed, code: " + failCode : "task failed");
    return { taskId: trimmed(data.taskId), status: "FAILURE", reason: reason };
  }
  const status = STATE_TO_STATUS[state];
  if (!status) return { status: "UNKNOWN", reason: "Unrecognized KIE task state: " + (state || "(empty)") };
  if (status !== "SUCCESS") {
    return { taskId: trimmed(data.taskId), status: status, progress: progressPercent(data, status) };
  }
  return { taskId: trimmed(data.taskId), status: "SUCCESS", progress: "100%" };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

function taskRecordData(task) {
  const raw = task && task.data;
  const data = recordData(raw);
  return data || null;
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS") return [];
  const data = taskRecordData(task);
  if (!data) return [];
  // TaskView carries no model field; the KIE record echoes the requested model.
  const model = trimmed(data.model);
  return artifactEntries(data, model).map(function (entry) {
    const artifact = { key: entry.key, type: entry.type };
    if (entry.mimeType) artifact.mimeType = entry.mimeType;
    return artifact;
  });
}

export function buildContentRequest(ctx) {
  const data = taskRecordData(ctx);
  if (!data) throw new Error("artifact_not_found");
  // The record's echoed model is authoritative so extension-less temporary
  // URLs categorize identically in listArtifacts and this lookup.
  const model = trimmed(data.model) || ctx.upstreamModel || ctx.model || "";
  const match = artifactEntries(data, model).find(function (entry) { return entry.key === ctx.artifactKey; });
  if (!match) throw new Error("artifact_not_found");
  return { url: match.url, method: ctx.clientRequest.method, credentialless: true };
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const job = isPlainObject(ctx.requestBody) ? ctx.requestBody : {};
  const input = isPlainObject(job.input) ? job.input : {};
  const model = resolveModel(ctx, job.model);
  return usageFor(model, input);
}

export function extractUsageOnComplete(task, taskResult, body) {
  const data = recordData(body);
  if (!data) return null;
  const model = trimmed(data.model);
  // KIE records generally do not echo the original video duration/resolution.
  // Return null for video completions so the host keeps the submit reservation.
  if (model && (categoryOf(model) === "video" || categoryOf(model) === "audio")) return null;
  const parsed = safeParseData(data);
  // An unparseable result cannot establish the real count: keep the submit
  // reservation. A parsed success with zero URLs (e.g. human-identification)
  // settles to zero files.
  if (!isPlainObject(parsed)) return null;
  const record = parseRecord(data);
  const deliverables = record.primary.length || record.frames.length || record.object.length;
  return { results: deliverables };
}

// ---------------------------------------------------------------------------
// openai_responses protocol
// ---------------------------------------------------------------------------

function responsesInput(req) {
  const texts = [];
  const images = [];
  const pushText = function (value) { if (trimmed(value)) texts.push(trimmed(value)); };

  const visitPart = function (part) {
    if (typeof part === "string") return pushText(part);
    if (!isPlainObject(part)) return;
    if ((part.type === "input_text" || part.type === "text" || part.type === "output_text") && typeof part.text === "string") pushText(part.text);
    if (part.type === "input_image" || part.type === "image_url") {
      let image = part.image_url;
      if (isPlainObject(image)) image = image.url;
      if (trimmed(image)) images.push(trimmed(image));
    }
  };

  const input = req.input;
  if (typeof input === "string") pushText(input);
  else if (Array.isArray(input)) {
    input.forEach(function (item) {
      if (typeof item === "string") return pushText(item);
      if (!isPlainObject(item)) return;
      const content = item.content === undefined ? [item] : Array.isArray(item.content) ? item.content : [item.content];
      content.forEach(visitPart);
    });
  }
  return {
    prompt: texts.join("\n"),
    images: images.filter(function (url, index, all) { return all.indexOf(url) === index; }),
  };
}

function protocolMetadata(req) {
  if (req.metadata === undefined || req.metadata === null) return {};
  if (!isPlainObject(req.metadata)) throw new Error("metadata must be an object");
  if (req.metadata.input !== undefined && req.metadata.input !== null && !isPlainObject(req.metadata.input)) {
    throw new Error("metadata.input must be an object");
  }
  return req.metadata;
}

function metadataInput(req) {
  const metadata = protocolMetadata(req);
  return isPlainObject(metadata.input) ? metadata.input : {};
}

function protocolCallback(req) {
  const metadata = protocolMetadata(req);
  return normalizeCallback(req.callBackUrl !== undefined ? req.callBackUrl : metadata.callBackUrl);
}

// Map an OpenAI-style request (Responses or Video) onto the KIE input object.
// `image_urls` is the common reference field across KIE models; any other
// model-specific parameter is supplied through metadata.input.
function buildProtocolInput(req) {
  const extracted = responsesInput(req);
  const prompt = trimmed(req.prompt) || extracted.prompt;
  const explicitImages = [];
  (Array.isArray(req.images) ? req.images : []).forEach(function (url) { if (trimmed(url)) explicitImages.push(trimmed(url)); });
  if (trimmed(req.image)) explicitImages.push(trimmed(req.image));
  extracted.images.forEach(function (url) { if (explicitImages.indexOf(url) === -1) explicitImages.push(url); });

  const input = Object.assign({}, metadataInput(req));
  if (prompt && input.prompt === undefined) input.prompt = prompt;
  if (explicitImages.length && input.image_urls === undefined) input.image_urls = explicitImages;
  return input;
}

function buildImagesProtocolInput(req) {
  const input = buildProtocolInput(req);
  ["n", "size"].forEach(function (key) {
    if (req[key] !== undefined && input[key] === undefined) input[key] = req[key];
  });
  return input;
}

function escapeAttribute(value) {
  return trimmed(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function artifactUrls(ctx, task) {
  return listArtifacts(task).map(function (artifact) {
    const served = ctx && ctx.artifacts && ctx.artifacts[artifact.key];
    return { type: artifact.type, url: trimmed(served && served.url) };
  }).filter(function (item) { return !!item.url; });
}

function mediaTags(ctx, task) {
  return artifactUrls(ctx, task).map(function (item) {
    const src = escapeAttribute(item.url);
    if (item.type === "video") return '<video controls src="' + src + '"></video>';
    if (item.type === "audio") return '<audio controls src="' + src + '"></audio>';
    return '<img src="' + src + '" alt="generated image" />';
  });
}

function resultText(ctx, task) {
  const tags = mediaTags(ctx, task);
  if (tags.length) return tags.join("\n\n");
  const data = taskRecordData(task);
  const parsed = data ? parseRecord(data) : null;
  if (parsed && parsed.resultObject !== null && parsed.resultObject !== undefined) {
    return "```json\n" + JSON.stringify(parsed.resultObject) + "\n```";
  }
  return "Generation completed, but no result URL was returned.";
}

function imageRenderItems(ctx, task) {
  const keys = listArtifacts(task)
    .filter(function (artifact) { return artifact.type === "image"; })
    .map(function (artifact) { return artifact.key; });
  const items = keys.map(function (key) {
    const served = ctx && ctx.artifacts && ctx.artifacts[key];
    return { url: trimmed(served && served.url), key: key };
  }).filter(function (item) { return !!item.url; });
  if (items.length) return items;

  const data = taskRecordData(task) || {};
  return artifactEntries(data, trimmed(data.model))
    .filter(function (entry) { return entry.type === "image" && entry.role === "primary"; })
    .map(function (entry) { return { url: entry.url, key: entry.key }; });
}

function imageRenderResponse(ctx, task) {
  return {
    created: task.updated_at || task.created_at || Math.floor(Date.now() / 1000),
    data: imageRenderItems(ctx, task).map(function (item) {
      return { url: item.url, b64_json: "", revised_prompt: "" };
    }),
  };
}

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!isPlainObject(req)) throw new Error("request body must be an object");
      if (!trimmed(ctx.model)) throw new Error("model is required");
      const input = buildProtocolInput(req);
      const job = { model: trimmed(ctx.model), input: input };
      const callBackUrl = protocolCallback(req);
      if (callBackUrl) job.callBackUrl = callBackUrl;
      // No display `action` here: the driver re-derives it after channel
      // model_mapping, when the true upstream model is known.
      return { kind: "submit", model: trimmed(ctx.model), requestBody: job };
    },

    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };

      if (status === "SUCCESS") {
        const text = resultText(ctx, task);
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: text }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE") {
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      }
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },

    renderFinal: function (ctx, task) {
      return {
        output: [{ type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: resultText(ctx, task), annotations: [], logprobs: [] }] }],
        metadata: { vendor: "kie" },
      };
    },
  },

  openai_video: {
    decodeRequest: function (ctx) {
      let req;
      if (ctx.body && ctx.body.kind === "json") {
        req = ctx.body.value;
      } else if (ctx.body && ctx.body.kind === "multipart") {
        req = {};
        if ((ctx.body.files || []).length) throw new Error("KIE accepts reference media as URLs, not file uploads; upload first and pass the returned URL");
        const first = function (name) {
          const values = (ctx.body.fields || {})[name] || [];
          if (values.length > 1) throw new Error(name + " must be provided once");
          return values[0];
        };
        Object.keys(ctx.body.fields || {}).forEach(function (name) {
          if (name === "images") req.images = (ctx.body.fields[name] || []).slice();
          else req[name] = first(name);
        });
        if (req.metadata !== undefined) {
          const parsed = safeParseJson(req.metadata);
          if (!isPlainObject(parsed)) throw new Error("metadata must be a JSON object string");
          req.metadata = parsed;
        }
      } else {
        throw new Error("JSON or multipart body required");
      }
      if (!isPlainObject(req)) throw new Error("request body must be an object");
      if (!trimmed(ctx.model)) throw new Error("model is required");
      const input = buildProtocolInput(req);
      const job = { model: trimmed(ctx.model), input: input };
      const callBackUrl = protocolCallback(req);
      if (callBackUrl) job.callBackUrl = callBackUrl;
      return { kind: "submit", model: trimmed(ctx.model), requestBody: job };
    },

    render: function (ctx, task) {
      const data = taskRecordData(task) || {};
      const state = trimmed(data.state).toLowerCase();
      const statuses = { waiting: "queued", queuing: "queued", queued: "queued", generating: "in_progress", processing: "in_progress", running: "in_progress", success: "completed", succeed: "completed", done: "completed", fail: "failed", failed: "failed", error: "failed" };
      const taskStatus = String(task.status || "").toUpperCase();
      const fallbackStatus = { SUCCESS: "completed", FAILURE: "failed", IN_PROGRESS: "in_progress", QUEUED: "queued", SUBMITTED: "queued", NOT_START: "queued" };
      const output = {
        id: task.task_id,
        object: "video",
        model: trimmed(data.model),
        status: statuses[state] || fallbackStatus[taskStatus] || "unknown",
        progress: Number(String(task.progress || "0").replace("%", "")) || 0,
        created_at: task.created_at,
        completed_at: task.updated_at,
      };
      if (task.status === "SUCCESS") {
        const entries = artifactEntries(data, trimmed(data.model));
        const videos = entries.filter(function (entry) { return entry.type === "video"; });
        const audio = entries.filter(function (entry) { return entry.type === "audio"; });
        // Video models list video files only (frames stay artifacts). Audio
        // products (TTS, Suno) surface audio URLs, since the video object is
        // the only result channel on this protocol.
        const shown = videos.length ? videos : (audio.length ? audio : entries.filter(function (entry) { return entry.role === "primary"; }));
        const urls = shown.map(function (entry) { return entry.url; });
        if (urls.length) {
          output.url = urls[0];
          output.urls = urls;
        }
      } else if (task.status === "FAILURE") {
        output.error = { code: trimmed(data.failCode) || "generation_failed", message: task.fail_reason || trimmed(data.failMsg) || "task failed" };
      }
      return output;
    },
  },

  openai_images: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!isPlainObject(req)) throw new Error("request body must be an object");
      if (!trimmed(ctx.model)) throw new Error("model is required");
      if (!IMAGE_PRODUCT_MODELS.has(trimmed(ctx.model))) throw new Error("model is not bound to openai_images: " + trimmed(ctx.model));
      const input = buildImagesProtocolInput(req);
      const job = { model: trimmed(ctx.model), input: input };
      const callBackUrl = protocolCallback(req);
      if (callBackUrl) job.callBackUrl = callBackUrl;
      return { kind: "submit", model: trimmed(ctx.model), requestBody: job };
    },

    render: function (ctx, task) {
      return imageRenderResponse(ctx || {}, task);
    },
  },
};

// ---------------------------------------------------------------------------
// Native surface
// ---------------------------------------------------------------------------

const NATIVE_STATE = { SUBMITTED: "waiting", QUEUED: "queuing", IN_PROGRESS: "generating", SUCCESS: "success", FAILURE: "fail", NOT_START: "waiting", UNKNOWN: "waiting" };

function nativeRecord(task) {
  const raw = isPlainObject(task.data) ? task.data : {};
  const source = isPlainObject(raw.data) ? raw.data : {};
  const data = Object.assign({}, source, { taskId: task.task_id });
  if (!trimmed(data.state)) {
    const status = String(task.status || "").toUpperCase();
    data.state = NATIVE_STATE[status] || status.toLowerCase();
    if (data.state === "fail") {
      if (!trimmed(data.failMsg)) data.failMsg = task.fail_reason || trimmed(raw.msg) || "task failed";
      if (!trimmed(data.failCode) && raw.code !== undefined && raw.code !== null && Number(raw.code) !== 200) {
        data.failCode = String(raw.code);
      }
    }
  }
  return { code: raw.code !== undefined && raw.code !== null ? Number(raw.code) : 200, msg: trimmed(raw.msg) || "success", data: data };
}

export const native = {
  createJob: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const value = ctx.body.value;
    if (!isPlainObject(value)) throw new Error("request body must be a JSON object");
    const job = normalizeJob(ctx, value, value.model);
    // The driver descriptor supplies the post-model_mapping display action.
    return { kind: "submit", model: job.model, requestBody: job };
  },

  jobCreated: function (ctx, task) {
    return { code: 200, msg: "success", data: { taskId: task.task_id } };
  },

  jobStatus: function (ctx, task) {
    return nativeRecord(task);
  },

  error: function (ctx, error) {
    let code = parseInt(error && error.code, 10);
    if (!Number.isFinite(code)) code = (error && error.httpStatus) || 400;
    return { code: code, msg: (error && error.message) || "error", data: null };
  },
};
