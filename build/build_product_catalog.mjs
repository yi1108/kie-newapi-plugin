// Builds the product-group catalog from the live pagePlaygroundGroup snapshot.
// The marketplace page is the source of truth: 104 product groups. Concrete
// createTask IDs stay internal and must never be counted as user-facing models.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const liveArg = process.argv.find((arg) => arg.startsWith("--live="));
const livePath = liveArg
  ? path.resolve(liveArg.slice("--live=".length))
  : path.resolve(root, "..", "new-api-kie-market", ".prod-data", "kie-live", "refresh", "chat-models-live.json");
const outputPath = path.join(root, "build", "product-groups.json");

// Default callable variant for each generation product group. Product groups
// remain public; these IDs only select KIE's default createTask implementation.
const generationDefaults = {
  "gpt-image-2-5": { upstreamModel: "gpt-image-2-5-sunburst-text-to-image", category: "image" },
  "gemini-omni-1-1-flash": { upstreamModel: "google/gemini-omni-flash-1-1", category: "video" },
  "wan3.0-video": { upstreamModel: "wan/3-0-video", category: "video" },
  "wan3.0-video-prime": { upstreamModel: "wan/3-0-video-prime", category: "video" },
  "kling-o3": { upstreamModel: "kling-3.0-omni/text-to-video", category: "video" },
  "wan-animate-2": { status: "coming_soon" },
  "grok-imagine-image-2": { upstreamModel: "grok-imagine-image-2-0/text-to-image", category: "image" },
  "minimax-h3": { upstreamModel: "minimax-h3/text-to-video", category: "video" },
  "flux-3": { status: "coming_soon" },
  "qwen-image-3": { upstreamModel: "qwen3/text-to-image", category: "image" },
  "pixverse-v6": { upstreamModel: "pixverse-v6/text-to-video", category: "video" },
  "gemini-3.1-flash-tts": { upstreamModel: "google/gemini-3-1-flash-tts", category: "audio" },
  "gemini-2.5-pro-preview-tts": { upstreamModel: "google/gemini-2-5-pro-tts", category: "audio" },
  "seedream-5-0-pro": { upstreamModel: "seedream/5-pro-text-to-image", category: "image" },
  "nano-banana-2-lite": { upstreamModel: "nano-banana-2-lite", category: "image" },
  "seedance-2-5": { upstreamModel: "bytedance/seedance-2-5", category: "video" },
  "seedance-2-0-mini": { upstreamModel: "bytedance/seedance-2-mini", category: "video" },
  "happyhorse-1-1": { upstreamModel: "happyhorse-1-1/text-to-video", category: "video" },
  "kling-3-0-turbo": { upstreamModel: "kling/v3-turbo-text-to-video", category: "video" },
  "volcengine-video-to-video-lip-sync": { upstreamModel: "volcengine/video-to-video-lip-sync", category: "video" },
  "omnihuman-1-5": { upstreamModel: "omnihuman-1-5", category: "video" },
  "grok-imagine-video-1.5": { upstreamModel: "grok-imagine-video-1-5-preview", category: "video" },
  "gemini-omni": { upstreamModel: "gemini-omni-video", category: "video" },
  "gpt-image-2": { upstreamModel: "gpt-image-2-text-to-image", category: "image" },
  "happyhorse-1-0 ": { upstreamModel: "happyhorse/text-to-video", category: "video" },
  "wan-2-7-video": { upstreamModel: "wan/2-7-text-to-video", category: "video" },
  "seedance-2-0": { upstreamModel: "bytedance/seedance-2", category: "video" },
  "wan-2-7-image": { upstreamModel: "wan/2-7-image", category: "image" },
  "qwen-image-2": { upstreamModel: "qwen2/text-to-image", category: "image" },
  "kling-3-motion-control": { upstreamModel: "kling-3.0/motion-control", category: "video" },
  "nano-banana-2": { upstreamModel: "nano-banana-2", category: "image" },
  "seedream5-0-lite": { upstreamModel: "seedream/5-lite-text-to-image", category: "image" },
  "kling-3-0": { upstreamModel: "kling-3.0/video", category: "video" },
  "elevenlabs/text-to-dialogue-v3": { upstreamModel: "elevenlabs/text-to-dialogue-v3", category: "audio" },
  "kling-2.6-motion-control": { upstreamModel: "kling-2.6/motion-control", category: "video" },
  "seedance-1-5-pro": { upstreamModel: "bytedance/seedance-1.5-pro", category: "video" },
  "wan-2-6": { upstreamModel: "wan/2-6-text-to-video", category: "video" },
  "gpt-image-1.5": { upstreamModel: "gpt-image/1.5-text-to-image", category: "image" },
  "seedream-4-5": { upstreamModel: "seedream/4.5-text-to-image", category: "image" },
  "kling-2-6": { upstreamModel: "kling-2.6/text-to-video", category: "video" },
  "z-image": { upstreamModel: "z-image", category: "image" },
  "flux-2": { upstreamModel: "flux-2/flex-text-to-image", category: "image" },
  "nano-banana-pro": { upstreamModel: "nano-banana-pro", category: "image" },
  "seedance-1-0-pro-fast": { upstreamModel: "bytedance/v1-pro-fast-image-to-video", category: "video" },
  "grok-imagine": { upstreamModel: "grok-imagine/text-to-video", category: "video" },
  "hailuo-2-3": { upstreamModel: "hailuo/2-3-image-to-video-standard", category: "video" },
  "veo-3-1": { upstreamModel: "veo-3-1", category: "video" },
  "features/v3-api": { upstreamModel: "v3-api", category: "video" },
  "4o-image-api": { upstreamModel: "4o-image-api", category: "image" },
  "flux-kontext-api": { upstreamModel: "flux1-kontext", category: "image" },
  "topaz-image-upscale": { upstreamModel: "topaz/image-upscale", category: "image" },
  "kling-2-5": { upstreamModel: "kling/v2-5-turbo-text-to-video-pro", category: "video" },
  "wan-2-5": { upstreamModel: "wan/2-5-text-to-video", category: "video" },
  "wan-animate": { upstreamModel: "wan/2-2-animate-move", category: "video" },
  "hailuo-api": { upstreamModel: "hailuo/02-text-to-video-standard", category: "video" },
  "topaz-video-upscaler": { upstreamModel: "topaz/video-upscale", category: "video" },
  "kling-ai-avatar": { upstreamModel: "kling/v1-avatar-standard", category: "video" },
  "seedream-api": { upstreamModel: "bytedance/seedream-v4-text-to-image", category: "image" },
  infinitalk: { upstreamModel: "infinitalk/from-audio", category: "video" },
  "recraft-remove-background": { upstreamModel: "recraft/remove-background", category: "image" },
  "recraft-crisp-upscale": { upstreamModel: "recraft/crisp-upscale", category: "image" },
  "elevenlabs-tts": { upstreamModel: "elevenlabs/text-to-speech-turbo-2-5", category: "audio" },
  "wan-speech-to-video-turbo": { upstreamModel: "wan/2-2-a14b-speech-to-video-turbo", category: "video" },
  seedream: { upstreamModel: "bytedance/seedream", category: "image" },
  "qwen-image": { upstreamModel: "qwen/text-to-image", category: "image" },
  "nano-banana": { upstreamModel: "google/nano-banana", category: "image" },
  "runway-api": { upstreamModel: "runway", category: "video" },
  "suno-api": { upstreamModel: "ai-music-api/generate", category: "audio" },
  "qwen/image-edit": { upstreamModel: "qwen/image-edit", category: "image" },
  "ideogram/character": { upstreamModel: "ideogram/character", category: "image" },
  "bytedance/seedance-v1": { upstreamModel: "bytedance/v1-pro-text-to-video", category: "video" },
  "kling/v2-1": { upstreamModel: "kling/v2-1-standard", category: "video" },
  "ideogram/v3": { upstreamModel: "ideogram/v3-text-to-image", category: "image" },
  "wan/v2-2": { upstreamModel: "wan/2-2-a14b-text-to-video-turbo", category: "video" },
  "google/imagen4": { upstreamModel: "google/imagen4", category: "image" },
};

const chatDefaults = {
  "gemini-3-8-flash": "gemini-3-8-flash-openai",
  "gemini-3-7-flash": "gemini-3-7-flash-openai",
  "gemini-3-6-flash": "gemini-3-6-flash-openai",
  "gemini-3-5-flash": "gemini-3-5-flash-openai",
  "gpt-5-6": "gpt-5-6-luna",
  codex: "gpt-5.4-codex",
  "gemini-3-flash": "gemini-3-flash",
};

const records = JSON.parse(fs.readFileSync(livePath, "utf8")).records;
if (!Array.isArray(records) || records.length !== 104) {
  throw new Error(`expected 104 live product groups, got ${Array.isArray(records) ? records.length : typeof records}`);
}

const products = records.map((record) => {
  const id = String(record.path || "").trim();
  const name = String(record.groupName || "").trim();
  const taskTypes = Array.isArray(record.taskType) ? record.taskType : [];
  const isChat = taskTypes.includes("Chat");
  const status = record.count === 0 || /Coming Soon/i.test(name) ? "coming_soon" : "available";
  const base = {
    id,
    name,
    provider: record.provider || "",
    kind: isChat ? "chat" : "generation",
    status,
    variantCount: Number(record.count) || 0,
    taskTypes,
  };
  if (isChat) {
    return { ...base, category: "chat", upstreamModel: chatDefaults[id] || id };
  }
  const override = generationDefaults[record.path];
  if (!override) throw new Error(`missing generation default for ${id}`);
  if (override.status === "coming_soon") return { ...base, category: "video", upstreamModel: "" };
  return { ...base, category: override.category, upstreamModel: override.upstreamModel };
});

const modelPaths = JSON.parse(fs.readFileSync(path.join(path.dirname(livePath), "model-paths-live.json"), "utf8")).data;
const knownPaths = new Set(modelPaths);
for (const product of products.filter((item) => item.status === "available" && item.kind === "generation")) {
  if (!knownPaths.has(product.upstreamModel)) {
    throw new Error(`default upstream model is absent from live model-paths: ${product.id} -> ${product.upstreamModel}`);
  }
}

const countBy = (predicate) => products.filter(predicate).length;
const catalog = {
  snapshotDate: "2026-09-10",
  source: "https://api.kie.ai/api/v1/playground/pagePlaygroundGroup",
  productGroups: products.length,
  counts: {
    all: products.length,
    available: countBy((item) => item.status === "available"),
    comingSoon: countBy((item) => item.status === "coming_soon"),
    chat: countBy((item) => item.kind === "chat"),
    chatAvailable: countBy((item) => item.kind === "chat" && item.status === "available"),
    generation: countBy((item) => item.kind === "generation"),
    generationAvailable: countBy((item) => item.kind === "generation" && item.status === "available"),
    byCategory: Object.fromEntries(
      ["image", "video", "audio", "chat"].map((category) => [
        category,
        countBy((item) => item.category === category && item.status === "available"),
      ])
    ),
  },
  note: "User-facing catalog counts product groups only. upstreamModel is an internal default concrete createTask ID; variants are not separate models.",
  products,
};

fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`wrote ${path.relative(root, outputPath)} (${products.length} product groups)`);
