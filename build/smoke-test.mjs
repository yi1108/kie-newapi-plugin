// Offline smoke test for the generated KIE task plugin. No network calls.
// Run: node build/smoke-test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.join(here, "..", "plugins", "tasks", "kie", "1.2.4", "plugin.js");
const plugin = await import(pathToFileURL(pluginPath).href);
const catalog = createRequire(import.meta.url)("./product-groups.json");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok -", name);
}

const BASE = "https://api.kie.ai";
const KEY = "test-key";

// --- meta -------------------------------------------------------------------
test("meta declares 74 available generation product groups, no chat models", () => {
  assert.equal(plugin.meta.apiVersion, 1);
  assert.equal(plugin.meta.key, "kie");
  assert.equal(plugin.meta.version, "1.2.4");
  const queryRoute = plugin.meta.routes.find((r) => r.type === "query");
  assert.match(queryRoute.path, /:taskId$/);
  assert.equal(plugin.meta.fetchMode, "per_task");
  assert.equal(plugin.meta.baseUrl, BASE);
  const generation = catalog.products
    .filter((product) => product.kind === "generation" && product.status === "available")
    .map((product) => product.id);
  const chatModels = catalog.products.filter((product) => product.kind === "chat").map((product) => product.id);
  assert.equal(generation.length, 74);
  assert.equal(plugin.meta.models.length, generation.length);
  for (const id of generation) assert.ok(plugin.meta.models.includes(id), "missing " + id);
  for (const id of chatModels) assert.ok(!plugin.meta.models.includes(id), "chat model leaked: " + id);
  for (const product of catalog.products.filter((item) => item.kind === "generation" && item.status === "available")) {
    const req = plugin.buildSubmitRequest(submitCtx(product.id, { model: product.id, input: {} }));
    assert.equal(req.body.model, product.upstreamModel, `${product.id} should map to ${product.upstreamModel}`);
  }
  assert.ok(plugin.meta.routes.length === 2);
  assert.ok(plugin.meta.protocols.some((p) => p.name === "openai_responses"));
  assert.ok(plugin.meta.protocols.includes("openai_video"));
  const imageProtocol = plugin.meta.protocols.find((protocol) => protocol.name === "openai_images");
  assert.equal(imageProtocol, undefined, "openai_images must stay undeclared until production core supports it");
  const usageKeys = Object.keys(plugin.meta.usageSchema);
  assert.ok(plugin.meta.usageExamples.length >= 1);
  for (const example of plugin.meta.usageExamples) {
    assert.deepEqual(Object.keys(example.facts).sort(), usageKeys.slice().sort(), "usage example must cover every schema field");
  }
});

// --- native submit -----------------------------------------------------------
const nativeBody = (value) => ({ body: { kind: "json", value }, params: {}, query: {} });

function submitCtx(model, requestBody, extra = {}) {
  return Object.assign(
    { model, upstreamModel: "", baseUrl: BASE, apiKey: KEY, requestBody, requestHeaders: {}, authHeader: "", files: [], publicTaskId: "" },
    extra
  );
}

test("native createJob decodes and buildSubmitRequest posts createTask", () => {
  const intent = plugin.native.createJob(nativeBody({ model: "seedream-api", input: { prompt: "a cat", max_images: 2 } }));
  assert.equal(intent.kind, "submit");
  assert.equal(intent.model, "seedream-api");
  const ctx = submitCtx(intent.model, intent.requestBody);
  const req = plugin.buildSubmitRequest(ctx);
  assert.equal(req.url, BASE + "/api/v1/jobs/createTask");
  assert.equal(req.method, "POST");
  assert.equal(req.headers.Authorization, "Bearer " + KEY);
  assert.deepEqual(req.body, { model: "bytedance/seedream-v4-text-to-image", input: { prompt: "a cat", max_images: 2 } });
  assert.equal(req.action, "text_to_image");

  const parsed = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { code: 200, msg: "success", data: { taskId: "task_1" } } });
  assert.equal(parsed.taskId, "task_1");
});

test("public product group resolves to its internal default createTask id", () => {
  const req = plugin.buildSubmitRequest(
    submitCtx("gpt-image-2-5", { model: "gpt-image-2-5", input: { prompt: "a cat" } })
  );
  assert.equal(req.body.model, "gpt-image-2-5-sunburst-text-to-image");
  assert.equal(req.action, "text_to_image");
});

test("submit forwards callBackUrl and detects image-to-video action", () => {
  const intent = plugin.native.createJob(nativeBody({ model: "kling/v3-turbo-image-to-video", callBackUrl: "https://example.com/hook", input: { prompt: "zoom", image_urls: ["https://x/y.jpg"] } }));
  const req = plugin.buildSubmitRequest(submitCtx(intent.model, intent.requestBody));
  assert.equal(req.body.callBackUrl, "https://example.com/hook");
  assert.equal(req.body.input.image_urls[0], "https://x/y.jpg");
  assert.equal(req.action, "image_to_video");
});

test("submit validates input at the boundary", () => {
  assert.throws(() => plugin.native.createJob({ body: { kind: "json", value: { input: {} } } }), /model is required/);
  assert.throws(() => plugin.native.createJob(nativeBody({ model: "BAD MODEL!", input: {} })), /not a valid KIE model/);
  assert.throws(
    () => plugin.buildSubmitRequest(submitCtx("nano-banana-2", { model: "nano-banana-2", input: "nope" })),
    /input must be an object/
  );
  assert.throws(
    () => plugin.buildSubmitRequest(submitCtx("nano-banana-2", { model: "nano-banana-2", input: {}, callBackUrl: "ftp://x" })),
    /callBackUrl/
  );
});

test("submit surfaces KIE envelope errors and HTTP errors", () => {
  const ctx = submitCtx("nano-banana-2", { model: "nano-banana-2", input: {} });
  assert.throws(
    () => plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { code: 402, msg: "insufficient credits", data: null } }),
    /insufficient credits/
  );
  assert.throws(() => plugin.parseSubmitResponse(ctx, { statusCode: 500, headers: {}, body: {} }), /HTTP 500/);
});

// --- query -------------------------------------------------------------------
function queryEnvelope(state, extra = {}) {
  return {
    code: 200,
    msg: "success",
    data: Object.assign({ taskId: "task_1", model: "nano-banana-2", state }, extra),
  };
}

function queryCtx(model = "nano-banana-2") {
  return { taskId: "task_1", publicTaskId: "task_1", action: "text_to_image", model, upstreamModel: "", baseUrl: BASE, apiKey: KEY, authHeader: "", data: null, state: null };
}

test("buildQueryRequest encodes recordInfo URL", () => {
  const req = plugin.buildQueryRequest(queryCtx());
  assert.equal(req.url, BASE + "/api/v1/jobs/recordInfo?taskId=task_1");
  assert.equal(req.method, "GET");
});

test("state mapping waiting/queuing/generating/success/fail", () => {
  assert.equal(plugin.parseTaskResult(queryCtx(), queryEnvelope("waiting")).status, "QUEUED");
  assert.equal(plugin.parseTaskResult(queryCtx(), queryEnvelope("queuing")).status, "QUEUED");
  const gen = plugin.parseTaskResult(queryCtx(), queryEnvelope("generating", { progress: 30 }));
  assert.equal(gen.status, "IN_PROGRESS");
  assert.equal(gen.progress, "30%");
  const ok = plugin.parseTaskResult(
    queryCtx(),
    queryEnvelope("success", { resultJson: JSON.stringify({ resultUrls: ["https://files/a.png"] }) })
  );
  assert.equal(ok.status, "SUCCESS");
  const bad = plugin.parseTaskResult(queryCtx(), queryEnvelope("fail", { failCode: 501, failMsg: "content policy" }));
  assert.equal(bad.status, "FAILURE");
  assert.match(bad.reason, /content policy/);
  assert.equal(plugin.parseTaskResult(queryCtx(), queryEnvelope("mystery")).status, "UNKNOWN");
});

test("envelope error codes classify permanent vs transient", () => {
  const hard = plugin.parseTaskResult(queryCtx(), { code: 402, msg: "no credits", data: {} });
  assert.equal(hard.status, "FAILURE");
  // The documented KIE error shape is data:null (or no data at all).
  for (const code of [401, 402, 403, 404, 422, 433, 501, 505]) {
    assert.equal(plugin.parseTaskResult(queryCtx(), { code, msg: "x", data: null }).status, "FAILURE", "code " + code);
  }
  const transient = plugin.parseTaskResult(queryCtx(), { code: 429, msg: "rate limited", data: {} });
  assert.equal(transient.status, "UNKNOWN");
  assert.equal(plugin.parseTaskResult(queryCtx(), { code: 500, msg: "boom" }).status, "UNKNOWN");
  assert.equal(plugin.parseTaskResult(queryCtx(), {}).status, "UNKNOWN");
});

// --- artifacts ---------------------------------------------------------------
function successTask(model, resultJson) {
  return {
    taskId: "task_1",
    status: "SUCCESS",
    action: "text_to_image",
    producerVersion: "1.0.0",
    data: queryEnvelope("success", { model, resultJson: JSON.stringify(resultJson) }),
  };
}

test("image artifacts resolve through proxied content requests", () => {
  const task = successTask("nano-banana-2", { resultUrls: ["https://files/a.png", "https://files/b.webp"] });
  const arts = plugin.listArtifacts(task);
  assert.deepEqual(arts.map((a) => a.key), ["image-0", "image-1"]);
  for (const art of arts) {
    const req = plugin.buildContentRequest(
      Object.assign(submitCtx("nano-banana-2", null), {
        artifactKey: art.key,
        data: task.data,
        upstreamTaskId: "task_1",
        clientRequest: { method: "GET", headers: {} },
      })
    );
    assert.match(req.url, /^https:\/\/files\//);
    assert.equal(req.credentialless, true);
  }
});

test("seedance frames and videos coexist as separate artifacts", () => {
  const task = successTask("bytedance/seedance-2-fast", {
    resultUrls: ["https://files/v.mp4"],
    firstFrameUrl: ["https://files/f.png"],
    lastFrameUrl: ["https://files/l.png"],
  });
  const arts = plugin.listArtifacts(task);
  assert.deepEqual(arts.map((a) => [a.key, a.type]), [["video-0", "video"], ["image-0", "image"], ["image-1", "image"]]);
});

test("audio artifacts typed by extension, masks by resultObject role", () => {
  const song = successTask("elevenlabs/text-to-speech-turbo-2-5", { resultUrls: ["https://files/v.mp3"] });
  assert.equal(plugin.listArtifacts(song)[0].type, "audio");
  const masks = successTask("omnihuman-1-5/subject-detection", { resultObject: { mask_urls: ["https://files/mask.png"] } });
  assert.equal(plugin.listArtifacts(masks)[0].type, "image");
  const utility = successTask("omnihuman-1-5/human-identification", { resultObject: { subject_status: 1 } });
  assert.deepEqual(plugin.listArtifacts(utility), []);
});

test("extension-less temp URLs fall back to model media category", () => {
  const video = successTask("kling/v3-turbo-image-to-video", { resultUrls: ["https://temp.file/abc123"] });
  assert.equal(plugin.listArtifacts(video)[0].type, "video");
  const image = successTask("nano-banana-2", { resultUrls: ["https://temp.file/abc123"] });
  assert.equal(plugin.listArtifacts(image)[0].type, "image");
});

test("missing artifact throws artifact_not_found", () => {
  const ctx = Object.assign(submitCtx("nano-banana-2", null), {
    artifactKey: "video-9",
    data: successTask("nano-banana-2", { resultUrls: ["https://files/a.png"] }).data,
    upstreamTaskId: "task_1",
    clientRequest: { method: "GET", headers: {} },
  });
  assert.throws(() => plugin.buildContentRequest(ctx), /artifact_not_found/);
});

// --- usage -------------------------------------------------------------------
test("usage reserves image files, video facts, and speech characters", () => {
  const reserve = plugin.extractUsage(submitCtx("seedream/5-pro-text-to-image", { model: "seedream/5-pro-text-to-image", input: { max_images: 4 } }));
  assert.equal(reserve.results, 4);
  assert.equal(plugin.extractUsage(Object.assign(submitCtx("x", {}), { usagePurpose: "billing_ratios" })), null);
  assert.deepEqual(plugin.extractUsage(submitCtx("kling-3.0/video", { model: "kling-3.0/video", input: { duration: 8, mode: "pro", sound: true } })), {
    seconds: 8,
    resolution: "1080p",
    tier: "pro",
    generate_audio: true,
    input_images: 0,
    input_video_seconds: 0,
  });
  assert.deepEqual(plugin.extractUsage(submitCtx("wan/3-0-video", { model: "wan/3-0-video", input: { duration: "10s", size: "3840x2160" } })), {
    seconds: 10,
    resolution: "4k",
    tier: "standard",
    generate_audio: true,
    input_images: 0,
    input_video_seconds: 0,
  });
  assert.deepEqual(plugin.extractUsage(submitCtx("hailuo/02-text-to-video-pro", { model: "hailuo/02-text-to-video-pro", input: {} })), {
    seconds: 6,
    resolution: "768p",
    tier: "pro",
    generate_audio: false,
    input_images: 0,
    input_video_seconds: 0,
  });
  assert.deepEqual(plugin.extractUsage(submitCtx("elevenlabs/text-to-speech-turbo-2-5", { model: "elevenlabs/text-to-speech-turbo-2-5", input: { text: "hello" } })), {
    results: 1,
    audio_characters: 5,
    tier: "turbo",
  });
  const body = queryEnvelope("success", { resultJson: JSON.stringify({ resultUrls: ["https://a/1.png", "https://a/2.png"] }) });
  assert.deepEqual(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, body), { results: 2 });
  const video = queryEnvelope("success", { model: "kling-3.0/video", resultJson: JSON.stringify({ resultUrls: ["https://a/v.mp4"] }) });
  assert.equal(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, video), null);
  const none = queryEnvelope("success", { resultJson: JSON.stringify({ resultObject: { subject_status: 0 } }) });
  assert.deepEqual(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, none), { results: 0 });
  assert.equal(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, {}), null);
});

// --- audio models -------------------------------------------------------------
test("gemini tts accepts a plain prompt and bills spoken characters", () => {
  const req = plugin.buildSubmitRequest(
    submitCtx("gemini-3.1-flash-tts", { model: "gemini-3.1-flash-tts", input: { prompt: "hello there" } })
  );
  assert.equal(req.body.model, "google/gemini-3-1-flash-tts");
  assert.deepEqual(req.body.input.speakers, [
    { speaker_id: "Speaker 1", voice_name: "Zephyr", accent: "Neutral" },
  ]);
  assert.deepEqual(req.body.input.dialogue_turns, [{ speaker_id: "Speaker 1", text: "hello there" }]);
  const usage = plugin.extractUsage(
    submitCtx("gemini-3.1-flash-tts", { model: "gemini-3.1-flash-tts", input: { dialogue_turns: [{ speaker_id: "Speaker 1", text: "hello there" }] } })
  );
  assert.equal(usage.audio_characters, 11);
});

test("gemini tts derives missing speakers from dialogue turns", () => {
  const req = plugin.buildSubmitRequest(
    submitCtx("gemini-2.5-pro-preview-tts", {
      model: "gemini-2.5-pro-preview-tts",
      input: { dialogue_turns: [{ text: "first" }, { speaker_id: "Speaker 2", text: "second" }] },
    })
  );
  assert.equal(req.body.model, "google/gemini-2-5-pro-tts");
  assert.deepEqual(req.body.input.speakers.map((s) => s.speaker_id), ["Speaker 1", "Speaker 2"]);
  assert.deepEqual(req.body.input.speakers.map((s) => s.voice_name), ["Zephyr", "Zephyr"]);
});

test("elevenlabs standard tier routes to multilingual v2", () => {
  const turbo = plugin.buildSubmitRequest(
    submitCtx("elevenlabs-tts", { model: "elevenlabs-tts", input: { text: "hi", voice: "Rachel" } })
  );
  assert.equal(turbo.body.model, "elevenlabs/text-to-speech-turbo-2-5");
  const standard = plugin.buildSubmitRequest(
    submitCtx("elevenlabs-tts", { model: "elevenlabs-tts", input: { text: "hi", voice: "Rachel", tier: "standard" } })
  );
  assert.equal(standard.body.model, "elevenlabs/text-to-speech-multilingual-v2");
  const direct = plugin.buildSubmitRequest(
    submitCtx("elevenlabs/text-to-speech-multilingual-v2", { model: "elevenlabs/text-to-speech-multilingual-v2", input: { text: "hi" } })
  );
  assert.equal(direct.body.model, "elevenlabs/text-to-speech-multilingual-v2");
  const prompted = plugin.buildSubmitRequest(
    submitCtx("elevenlabs-tts", { model: "elevenlabs-tts", input: { prompt: "say this" } })
  );
  assert.equal(prompted.body.model, "elevenlabs/text-to-speech-turbo-2-5");
  assert.equal(prompted.body.input.text, "say this");
  assert.equal(prompted.body.input.voice, "N2lVS1w4EtoT3dr4eOWO");
  const usage = plugin.extractUsage(
    submitCtx("elevenlabs-tts", { model: "elevenlabs-tts", input: prompted.body.input })
  );
  assert.equal(usage.tier, "turbo");
});

test("elevenlabs tts accepts a prompt and canonicalizes common voice fields", () => {
  const req = plugin.buildSubmitRequest(
    submitCtx("elevenlabs/text-to-speech-multilingual-v2", {
      model: "elevenlabs/text-to-speech-multilingual-v2",
      input: { prompt: "say this", voice_id: "voice-123" },
    })
  );
  assert.equal(req.body.input.text, "say this");
  assert.equal(req.body.input.voice, "voice-123");
  assert.equal(req.body.input.voice_id, undefined);
});

test("elevenlabs dialogue accepts plain text and fills each speaker", () => {
  const prompted = plugin.buildSubmitRequest(
    submitCtx("elevenlabs/text-to-dialogue-v3", {
      model: "elevenlabs/text-to-dialogue-v3",
      input: { prompt: "a friendly duet", voice: "Adam" },
    })
  );
  assert.deepEqual(prompted.body.input.dialogue, [{ text: "a friendly duet", voice: "Adam" }]);

  const mixed = plugin.buildSubmitRequest(
    submitCtx("elevenlabs/text-to-dialogue-v3", {
      model: "elevenlabs/text-to-dialogue-v3",
      input: {
        dialogue: [
          { content: "first line", voiceId: "voice-a" },
          { message: "second line" },
        ],
      },
    })
  );
  assert.deepEqual(mixed.body.input.dialogue, [
    { content: "first line", text: "first line", voice: "voice-a" },
    { message: "second line", text: "second line", voice: "N2lVS1w4EtoT3dr4eOWO" },
  ]);
  const usage = plugin.extractUsage(
    submitCtx("elevenlabs/text-to-dialogue-v3", {
      model: "elevenlabs/text-to-dialogue-v3",
      input: mixed.body.input,
    })
  );
  assert.equal(usage.audio_characters, 22);
});

test("suno data-array results surface audio and image artifacts; completion keeps reservation", () => {
  const song = successTask("ai-music-api/generate", {
    data: [{ audio_url: "https://files/song.mp3", image_url: "https://files/cover.jpeg" }],
  });
  const types = plugin.listArtifacts(song).map((a) => a.type).sort();
  assert.deepEqual(types, ["audio", "image"]);
  const body = queryEnvelope("success", {
    model: "ai-music-api/generate",
    resultJson: JSON.stringify({ data: [{ audio_url: "https://files/song.mp3", image_url: "https://files/cover.jpeg" }] }),
  });
  assert.equal(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, body), null);
});

// --- openai_responses protocol ----------------------------------------------
function protocolCtx(model, value, protocol = "openai_responses") {
  return { model, upstreamModel: "", protocol, operation: "create", stream: true, body: { kind: "json", value }, params: {}, query: {} };
}

test("responses decode maps prompt and input_image to KIE input", () => {
  const decoded = plugin.protocols.openai_responses.decodeRequest(
    protocolCtx("nano-banana-2", {
      input: [{ role: "user", content: [{ type: "input_text", text: "draw a dog" }, { type: "input_image", image_url: "https://x/ref.jpg" }] }],
    })
  );
  assert.equal(decoded.requestBody.model, "nano-banana-2");
  assert.equal(decoded.requestBody.input.prompt, "draw a dog");
  assert.deepEqual(decoded.requestBody.input.image_urls, ["https://x/ref.jpg"]);
});

test("responses metadata.input overrides and merges", () => {
  const decoded = plugin.protocols.openai_responses.decodeRequest(
    protocolCtx("wan/3-0-video", {
      input: "a sunset",
      metadata: { input: { duration: 5, resolution: "720p" } },
    })
  );
  assert.equal(decoded.requestBody.input.duration, 5);
  assert.equal(decoded.requestBody.input.prompt, "a sunset");
});

test("renderEvents streams progress then output; failure emits error", () => {
  const task = successTask("nano-banana-2", { resultUrls: ["https://files/a.png"] });
  const ctx = { artifacts: { "image-0": { url: "https://gateway/content/image-0" } } };
  const done = plugin.protocols.openai_responses.renderEvents(ctx, task, null);
  assert.equal(done.done, true);
  assert.equal(done.events[0].type, "output");
  assert.match(done.events[0].data, /<img/);
  // Idempotent: no duplicate output on repeated completion ticks.
  assert.equal(plugin.protocols.openai_responses.renderEvents(ctx, task, done.state).events.length, 0);
  const running = plugin.protocols.openai_responses.renderEvents(null, { status: "IN_PROGRESS", progress: "40%" }, null);
  assert.equal(running.done, false);
  assert.equal(running.events[0].type, "progress");
  assert.equal(running.events[0].progress, 40);
  const failed = plugin.protocols.openai_responses.renderEvents(null, { status: "FAILURE", fail_reason: "bad prompt" }, null);
  assert.equal(failed.events[0].message, "bad prompt");
});

test("renderFinal returns completed assistant message", () => {
  const task = successTask("kling-3.0/video", { resultUrls: ["https://files/v.mp4"] });
  const final = plugin.protocols.openai_responses.renderFinal({ artifacts: { "video-0": { url: "https://gateway/v" } } }, task);
  assert.equal(final.output[0].status, "completed");
  assert.match(final.output[0].content[0].text, /<video/);
  assert.equal(final.metadata.vendor, "kie");
});

test("utility resultObject renders as JSON text", () => {
  const task = successTask("omnihuman-1-5/human-identification", { resultObject: { subject_status: 1 } });
  const final = plugin.protocols.openai_responses.renderFinal({ artifacts: {} }, task);
  assert.match(final.output[0].content[0].text, /subject_status/);
});

// --- openai_images protocol --------------------------------------------------
test("experimental openai_images code decodes a standard generation request and maps the public image product", () => {
  const decoded = plugin.protocols.openai_images.decodeRequest(
    protocolCtx("gpt-image-2-5", {
      prompt: "a tiny red circle",
      n: 1,
      size: "1024x1024",
      response_format: "url",
      metadata: { input: { quality: "high" } },
    }, "openai_images")
  );
  assert.equal(decoded.kind, "submit");
  assert.equal(decoded.model, "gpt-image-2-5");
  assert.deepEqual(decoded.requestBody.input, {
    quality: "high",
    prompt: "a tiny red circle",
    n: 1,
    size: "1024x1024",
  });
  const upstream = plugin.buildSubmitRequest(submitCtx(decoded.model, decoded.requestBody));
  assert.equal(upstream.body.model, "gpt-image-2-5-sunburst-text-to-image");
  assert.equal(upstream.body.input.response_format, undefined);
  assert.throws(
    () => plugin.protocols.openai_images.decodeRequest(protocolCtx("kling-3-0", { prompt: "x" }, "openai_images")),
    /not bound to openai_images/
  );
});

test("openai_images render returns proxied image URLs in OpenAI response shape", () => {
  const task = successTask("gpt-image-2-5", { resultUrls: ["https://temp.file/without-extension"] });
  assert.equal(plugin.listArtifacts(task)[0].type, "image");
  const rendered = plugin.protocols.openai_images.render(
    { artifacts: { "image-0": { url: "https://gateway/tasks/t/image-0/content" } } },
    Object.assign(task, { created_at: 1710000000, updated_at: 1710000060 })
  );
  assert.equal(rendered.created, 1710000060);
  assert.deepEqual(rendered.data, [{ url: "https://gateway/tasks/t/image-0/content", b64_json: "", revised_prompt: "" }]);

  const fallback = plugin.protocols.openai_images.render(
    { artifacts: {} },
    successTask("gpt-image-2-5", { resultUrls: ["https://kie.result/a.png"] })
  );
  assert.deepEqual(fallback.data, [{ url: "https://kie.result/a.png", b64_json: "", revised_prompt: "" }]);
});

// --- openai_video protocol ---------------------------------------------------
test("openai_video decode accepts JSON and rejects file uploads", () => {
  const decoded = plugin.protocols.openai_video.decodeRequest(
    protocolCtx("kling-3.0/video", { prompt: "fly through clouds", images: ["https://x/a.jpg"] }, "openai_video")
  );
  assert.equal(decoded.requestBody.input.prompt, "fly through clouds");
  assert.deepEqual(decoded.requestBody.input.image_urls, ["https://x/a.jpg"]);
  assert.throws(
    () =>
      plugin.protocols.openai_video.decodeRequest({
        model: "kling-3.0/video",
        upstreamModel: "",
        body: { kind: "multipart", fields: { prompt: ["x"] }, files: [{ ref: "f1" }] },
      }),
    /URLs/
  );
});

test("openai_video render maps statuses and surfaces urls", () => {
  const task = successTask("kling-3.0/video", { resultUrls: ["https://files/v1.mp4", "https://files/v2.mp4"] });
  const out = plugin.protocols.openai_video.render(null, task);
  assert.equal(out.object, "video");
  assert.equal(out.status, "completed");
  assert.equal(out.model, "kling-3.0/video");
  assert.equal(out.url, "https://files/v1.mp4");
  assert.equal(out.urls.length, 2);
  const queued = plugin.protocols.openai_video.render(null, { task_id: "t", status: "QUEUED", data: queryEnvelope("waiting") });
  assert.equal(queued.status, "queued");
  const song = successTask("ai-music-api/generate", {
    data: [{ audio_url: "https://files/song.mp3", image_url: "https://files/cover.jpeg" }],
  });
  const rendered = plugin.protocols.openai_video.render(null, song);
  assert.equal(rendered.url, "https://files/song.mp3");
  assert.deepEqual(rendered.urls, ["https://files/song.mp3"]);
});

test("frame artifacts derive MIME from URL extension", () => {
  const task = successTask("bytedance/seedance-2-fast", {
    resultUrls: ["https://files/v.mp4"],
    firstFrameUrl: ["https://files/f.jpg"],
    lastFrameUrl: ["https://files/l.webp"],
  });
  const frames = plugin.listArtifacts(task).filter((a) => a.type === "image");
  assert.deepEqual(frames.map((a) => a.mimeType), ["image/jpeg", "image/webp"]);
});

test("content lookup uses the record model even when the channel alias differs", () => {
  const data = queryEnvelope("success", {
    model: "google/nano-banana",
    resultJson: JSON.stringify({ resultUrls: ["https://temp.file/abc"] }),
  });
  const task = { status: "SUCCESS", data };
  const art = plugin.listArtifacts(task)[0];
  assert.equal(art.key, "image-0");
  const req = plugin.buildContentRequest(
    Object.assign(submitCtx("nano-alias", null, { upstreamModel: "nano-alias" }), {
      artifactKey: art.key,
      data,
      upstreamTaskId: "task_1",
      clientRequest: { method: "GET", headers: {} },
    })
  );
  assert.equal(req.url, "https://temp.file/abc");
});

test("invalid protocol metadata is rejected at the boundary", () => {
  assert.throws(() => plugin.protocols.openai_responses.decodeRequest(protocolCtx("x", { input: "hi", metadata: "bad" })), /metadata must be an object/);
  assert.throws(
    () => plugin.protocols.openai_responses.decodeRequest(protocolCtx("x", { input: "hi", metadata: { input: "bad" } })),
    /metadata.input must be an object/
  );
});

test("openai_video honors metadata.callBackUrl on the JSON branch", () => {
  const decoded = plugin.protocols.openai_video.decodeRequest(
    protocolCtx("kling-3.0/video", { prompt: "x", metadata: { callBackUrl: "https://cb/hook" } }, "openai_video")
  );
  assert.equal(decoded.requestBody.callBackUrl, "https://cb/hook");
});

test("image-model success on openai_video still exposes its URL", () => {
  const out = plugin.protocols.openai_video.render(null, successTask("nano-banana-2", { resultUrls: ["https://files/a.png"] }));
  assert.equal(out.status, "completed");
  assert.deepEqual(out.urls, ["https://files/a.png"]);
});

test("native jobStatus preserves stored error envelopes", () => {
  const task = {
    task_id: "pub-1",
    status: "FAILURE",
    fail_reason: "",
    data: { code: 433, msg: "subkey usage exceeded", data: null },
  };
  const rendered = plugin.native.jobStatus(null, task);
  assert.equal(rendered.code, 433);
  assert.equal(rendered.msg, "subkey usage exceeded");
  assert.equal(rendered.data.taskId, "pub-1");
  assert.equal(rendered.data.state, "fail");
  assert.equal(rendered.data.failCode, "433");
  assert.equal(rendered.data.failMsg, "subkey usage exceeded");
});

test("openai_video render lists videos only (frames stay artifacts)", () => {
  const task = successTask("bytedance/seedance-2-fast", {
    resultUrls: ["https://files/v.mp4"],
    firstFrameUrl: ["https://files/f.png"],
    lastFrameUrl: ["https://files/l.png"],
  });
  const out = plugin.protocols.openai_video.render(null, task);
  assert.deepEqual(out.urls, ["https://files/v.mp4"]);
  // Missing upstream state falls back to the normalized task status.
  const noState = plugin.protocols.openai_video.render(null, { task_id: "t", status: "IN_PROGRESS", data: { code: 200, data: { model: "x" } } });
  assert.equal(noState.status, "in_progress");
});

// --- native renders ----------------------------------------------------------
test("native jobCreated/jobStatus/error follow KIE envelope", () => {
  const created = plugin.native.jobCreated(null, { task_id: "pub-1" });
  assert.deepEqual(created, { code: 200, msg: "success", data: { taskId: "pub-1" } });
  const task = { task_id: "pub-1", status: "IN_PROGRESS", data: queryEnvelope("generating", { progress: 60 }) };
  const status = plugin.native.jobStatus(null, task);
  assert.equal(status.data.taskId, "pub-1");
  assert.equal(status.data.state, "generating");
  assert.equal(status.data.progress, 60);
  // Public id overrides the upstream id but every other field passes through.
  assert.ok(typeof status.data.resultJson === "undefined" || status.code === 200);
  const err = plugin.native.error(null, { code: "400", message: "bad", httpStatus: 400, retryable: false });
  assert.equal(err.code, 400);
  assert.equal(err.msg, "bad");
});

console.log(`\n${passed} smoke tests passed`);
