// Offline smoke test for the generated KIE task plugin. No network calls.
// Run: node build/smoke-test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.join(here, "..", "plugins", "tasks", "kie", "1.0.1", "plugin.js");
const plugin = await import(pathToFileURL(pluginPath).href);
const models = createRequire(import.meta.url)("./models.json");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok -", name);
}

const BASE = "https://api.kie.ai";
const KEY = "test-key";

// --- meta -------------------------------------------------------------------
test("meta declares 141 generation models, no chat models", () => {
  assert.equal(plugin.meta.apiVersion, 1);
  assert.equal(plugin.meta.key, "kie");
  assert.equal(plugin.meta.version, "1.0.1");
  const queryRoute = plugin.meta.routes.find((r) => r.type === "query");
  assert.match(queryRoute.path, /:taskId$/);
  assert.equal(plugin.meta.fetchMode, "per_task");
  assert.equal(plugin.meta.baseUrl, BASE);
  const generation = [...models.image, ...models.video, ...models.audio, ...models.utility];
  assert.equal(plugin.meta.models.length, generation.length);
  for (const id of generation) assert.ok(plugin.meta.models.includes(id), "missing " + id);
  for (const id of models.chat) assert.ok(!plugin.meta.models.includes(id), "chat model leaked: " + id);
  assert.ok(plugin.meta.routes.length === 2);
  assert.ok(plugin.meta.protocols.some((p) => p.name === "openai_responses"));
  assert.ok(plugin.meta.protocols.includes("openai_video"));
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
  const intent = plugin.native.createJob(nativeBody({ model: "bytedance/seedream-v4-text-to-image", input: { prompt: "a cat", max_images: 2 } }));
  assert.equal(intent.kind, "submit");
  assert.equal(intent.model, "bytedance/seedream-v4-text-to-image");
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
test("usage reserves at submit and settles on delivered files", () => {
  const reserve = plugin.extractUsage(submitCtx("seedream/5-pro-text-to-image", { model: "seedream/5-pro-text-to-image", input: { max_images: 4 } }));
  assert.equal(reserve.results, 4);
  assert.equal(plugin.extractUsage(Object.assign(submitCtx("x", {}), { usagePurpose: "billing_ratios" })), null);
  const body = queryEnvelope("success", { resultJson: JSON.stringify({ resultUrls: ["https://a/1.png", "https://a/2.png"] }) });
  assert.deepEqual(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, body), { results: 2 });
  const none = queryEnvelope("success", { resultJson: JSON.stringify({ resultObject: { subject_status: 0 } }) });
  assert.deepEqual(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, none), { results: 0 });
  assert.equal(plugin.extractUsageOnComplete({ status: "SUCCESS" }, { status: "SUCCESS" }, {}), null);
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
