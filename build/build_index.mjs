// Generates index.json from the compiled plugin metas, mirroring the official
// tools/pluginindex contract: directory key/version must agree with meta,
// display fields come from the newest compiled meta, and sha256 is taken over
// the source bytes. Run: node build/build_index.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const tasksDir = path.join(root, "plugins", "tasks");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function semverLess(left, right) {
  const [leftCore, leftRest = ""] = left.split("-");
  const [rightCore, rightRest = ""] = right.split("-");
  const leftParts = leftCore.split(".");
  const rightParts = rightCore.split(".");
  for (let i = 0; i < 3; i++) {
    if (leftParts[i] !== rightParts[i]) return Number(leftParts[i] || 0) < Number(rightParts[i] || 0);
  }
  return leftRest < rightRest;
}

async function collectPlugin(keyDir, key) {
  const versionNames = fs.readdirSync(keyDir).filter((name) => fs.statSync(path.join(keyDir, name)).isDirectory());
  const versions = [];
  const byVersion = new Map();
  for (const version of versionNames) {
    const pluginFile = path.join(keyDir, version, "plugin.js");
    if (!fs.existsSync(pluginFile)) throw new Error(`missing plugin.js: plugins/tasks/${key}/${version}`);
    const mod = await import(pathToFileURL(pluginFile).href + `?t=${Date.now()}`);
    const meta = mod.meta;
    if (meta.key !== key) throw new Error(`${key}/${version}: meta.key is "${meta.key}"`);
    if (meta.version !== version) throw new Error(`${key}/${version}: meta.version is "${meta.version}"`);
    if (meta.apiVersion !== 1) throw new Error(`${key}/${version}: unsupported apiVersion ${meta.apiVersion}`);
    const rel = `plugins/tasks/${key}/${version}/plugin.js`;
    const entry = { version, path: rel, sha256: sha256(pluginFile), minApiVersion: meta.apiVersion, kind: "task" };
    if (Array.isArray(meta.allowedHosts) && meta.allowedHosts.length) entry.allowedHosts = meta.allowedHosts;
    if (meta.baseUrl) entry.baseUrl = meta.baseUrl;
    const authType = typeof meta.auth === "object" ? meta.auth && meta.auth.type : meta.auth;
    if (authType && authType !== "none") entry.auth = authType;
    versions.push(entry);
    byVersion.set(version, meta);
  }
  if (!versions.length) throw new Error(`plugin ${key} has no versions`);
  versions.sort((a, b) => (semverLess(a.version, b.version) ? 1 : -1));
  const latest = versions[0].version;
  const meta = byVersion.get(latest);

  const plugin = { key: meta.key, name: meta.name };
  if (meta.icon) plugin.icon = meta.icon;
  const iconFile = ["icon.svg", "icon.png"].map((name) => path.join(keyDir, name)).find((file) => fs.existsSync(file));
  if (iconFile) {
    plugin.iconFile = { path: `plugins/tasks/${key}/${path.basename(iconFile)}`, sha256: sha256(iconFile) };
  }
  if (meta.website) plugin.website = meta.website;
  if (meta.sortPriority !== undefined) plugin.sortPriority = meta.sortPriority;
  if (meta.description) plugin.description = meta.description;
  if (Array.isArray(meta.protocols) && meta.protocols.length) plugin.protocols = meta.protocols;
  if (Array.isArray(meta.channelTypes) && meta.channelTypes.length) plugin.channelTypes = meta.channelTypes;
  plugin.models = meta.models;
  plugin.latest = latest;
  plugin.versions = versions;
  return plugin;
}

const keys = fs.readdirSync(tasksDir).filter((name) => fs.statSync(path.join(tasksDir, name)).isDirectory());
const plugins = [];
for (const key of keys) plugins.push(await collectPlugin(path.join(tasksDir, key), key));
plugins.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

const index = { indexVersion: 1, name: "KIE.AI Plugins", plugins };
fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
console.log(`wrote index.json (${plugins.length} plugin(s), latest ${plugins.map((p) => p.key + "@" + p.latest).join(", ")})`);
