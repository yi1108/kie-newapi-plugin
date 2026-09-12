// Live end-to-end test against the real KIE API, driving the plugin hooks
// exactly as the gateway would. Consumes a small amount of KIE credits.
//
// Usage (Git Bash):
//   KIE_API_KEY=sk-xxx node build/live-test.mjs [model] [prompt]
//
// Defaults to the cheapest practical image model. Env vars only — never put
// the key in source or arguments that shell history keeps verbosely.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const plugin = await import(pathToFileURL(path.join(root, "plugins", "tasks", "kie", "1.2.4", "plugin.js")).href);

const apiKey = process.env.KIE_API_KEY || "";
if (!apiKey) {
  console.error("KIE_API_KEY environment variable is required");
  process.exit(2);
}
const model = process.argv[2] || "nano-banana-2";
const prompt = process.argv[3] || "a small rubber duck on a desk, studio light";
const baseUrl = "https://api.kie.ai";
const deadline = Date.now() + 10 * 60 * 1000;

function log(step, detail) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${step}${detail ? " " + detail : ""}`);
}

async function call(descriptor) {
  const res = await fetch(descriptor.url, {
    method: descriptor.method || "GET",
    headers: descriptor.headers,
    body: descriptor.body ? JSON.stringify(descriptor.body) : undefined,
  });
  const body = await res.json().catch(() => null);
  return { statusCode: res.status, headers: Object.fromEntries(res.headers), body };
}

// --- 1. submit through the plugin hook ---------------------------------------
const submitCtx = {
  model, upstreamModel: "", baseUrl, apiKey,
  requestBody: { model, input: { prompt, max_images: 1 } },
  requestHeaders: {}, authHeader: "", files: [], publicTaskId: "",
};
const submitReq = plugin.buildSubmitRequest(submitCtx);
log("submit action:", submitReq.action, "->", submitReq.url);
const submitResp = await call(submitReq);
console.log("  upstream:", JSON.stringify(submitResp.body).slice(0, 300));
let taskId;
try {
  ({ taskId } = plugin.parseSubmitResponse(submitCtx, submitResp));
} catch (e) {
  console.error("parseSubmitResponse failed:", e.message);
  process.exit(1);
}
log("task created:", taskId);

// --- 2. poll through the plugin hook -----------------------------------------
const queryCtx = {
  taskId, publicTaskId: taskId, action: submitReq.action, model, upstreamModel: "",
  baseUrl, apiKey, authHeader: "", data: null, state: null,
};
let result;
const task = { task_id: taskId, status: "QUEUED" };
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000));
  const queryReq = plugin.buildQueryRequest(queryCtx);
  const queryResp = await call(queryReq);
  result = plugin.parseTaskResult(queryCtx, queryResp.body);
  task.status = result.status;
  task.progress = result.progress;
  task.data = queryResp.body;
  if (result.reason) task.fail_reason = result.reason;
  log("poll:", result.status, result.progress || "", result.reason || "");
  if (["SUCCESS", "FAILURE"].includes(result.status)) break;
}
if (!result || result.status !== "SUCCESS") {
  console.error("task did not succeed:", result && result.status, result && result.reason);
  process.exit(1);
}

// --- 3. artifacts through listArtifacts + buildContentRequest ----------------
task.data = (await call(plugin.buildQueryRequest(queryCtx))).body;
const artifacts = plugin.listArtifacts(task);
log("artifacts:", JSON.stringify(artifacts));
if (!artifacts.length) {
  console.log("(no file artifacts — checking text result rendering)");
}
const outDir = path.join(root, "build", "live-out");
fs.mkdirSync(outDir, { recursive: true });
for (const artifact of artifacts) {
  const contentReq = plugin.buildContentRequest({
    ...submitCtx, artifactKey: artifact.key, data: task.data,
    upstreamTaskId: taskId, clientRequest: { method: "GET", headers: {} },
  });
  const head = await fetch(contentReq.url, { method: "GET", headers: { Range: "bytes=0-1023" } });
  const buf = Buffer.from(await head.arrayBuffer());
  const ext = { video: ".mp4", audio: ".mp3", image: ".img", file: ".bin" }[artifact.type];
  const file = path.join(outDir, `${crypto.createHash("sha1").update(artifact.key).digest("hex").slice(0, 8)}${ext}`);
  fs.writeFileSync(file, buf);
  console.log(`  ${artifact.key} ${artifact.type} upstream HTTP ${head.status} ${buf.length}B header -> ${path.basename(file)}`);
  if (head.status >= 400) process.exitCode = 1;
}

// --- 4. protocol render surfaces ----------------------------------------------
const events = plugin.protocols.openai_responses.renderEvents({}, task, null);
console.log("responses events:", JSON.stringify(events).slice(0, 400));
const video = plugin.protocols.openai_video.render(null, task);
console.log("video object:", JSON.stringify({ status: video.status, url: video.url, urls: (video.urls || []).length }));
const usage = plugin.extractUsageOnComplete(task, result, task.data);
console.log("usage on complete:", JSON.stringify(usage));
log("LIVE TEST PASSED");
