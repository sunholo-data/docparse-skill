// Validates the portable (Agent Plugins / OpenAI) manifests alongside the
// Claude ones. There is no official validator CLI for Agent Plugins — OpenAI
// validates only on ZIP upload — so this checks the published JSON Schemas
// plus the cross-manifest invariants that neither vendor checks for us:
// one MCP URL, one version, and the OpenAI listing limits.
//
// Run: npm i --no-save ajv ajv-formats && node scripts/validate-agent-plugins.mjs
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const PLUGIN_DIR = "plugins/ailang-parse";
const SCHEMAS = {
  plugin: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  mcp: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
};

const errors = [];
const fail = (msg) => errors.push(msg);
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

// WCAG relative-luminance contrast ratio of two #RRGGBB colours.
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Icons: "square and at least 48×48"; raster at most 4096px; an SVG needs
// "square numeric dimensions or a square viewBox of at least 48 by 48".
function checkIcon(label, path) {
  const buf = readFileSync(path);
  if (buf.length > 5 * 1024 * 1024) fail(`${label}: larger than 5 MiB`);
  if (path.endsWith(".png")) {
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== h || w < 48 || w > 4096) fail(`${label}: ${w}x${h}, need square, 48..4096 px`);
  } else if (path.endsWith(".svg")) {
    const m = /viewBox="\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/.exec(buf.toString("utf8"));
    if (!m || m[1] !== m[2] || Number(m[1]) < 48) fail(`${label}: SVG viewBox must be square and at least 48x48`);
  }
}

const compiled = {};
async function validate(kind, file, doc = readJSON(file)) {
  if (!compiled[kind]) {
    const res = await fetch(SCHEMAS[kind]);
    if (!res.ok) throw new Error(`fetch ${SCHEMAS[kind]}: HTTP ${res.status}`);
    compiled[kind] = ajv.compile(await res.json());
  }
  const check = compiled[kind];
  if (!check(doc)) {
    for (const e of check.errors) fail(`${file}${e.instancePath} ${e.message}`);
  }
}

// Two mcp.json files, one server.
//
// plugins/ailang-parse/mcp.json is what Codex installs. The Codex CLI parses it
// with deny_unknown_fields (openai/codex codex-rs/codex-mcp/src/
// agent_plugin_config.rs) and silently drops a server carrying `extensions`,
// so it must stay plain.
//
// openai-submission/mcp.json replaces it in the portal ZIP
// (scripts/build-openai-submission.sh). The portal "reads advanced
// authentication settings from your package's mcp.json", under each server's
// extensions["com.openai"].auth (developers.openai.com/plugins/build/plugins,
// "Configure MCP authentication"). The published Agent Plugins 1.0.0 schema
// has additionalProperties:false on a server and rejects `extensions`,
// although OpenAI's own example pairs that $schema with it, so the auth block
// is checked against OpenAI's documented fields and the rest against the schema.
const AUTH_TYPES = ["none", "oauth", "mixed", "api_key"];
const AUTH_FIELDS = ["type", "client", "authorizationUrl", "tokenUrl", "registrationUrl",
  "authorizationServerBase", "resource", "baseScopes", "defaultScopes", "oidcEnabled",
  "oidcConfigurationUrl", "oidcUserinfoEndpoint", "oidcScopesSupported"];
const CLIENT_MODES = ["provided", "dcr", "cimd"];
const mcpFile = join(PLUGIN_DIR, "mcp.json");
const submissionFile = "openai-submission/mcp.json";

function checkServers(file, doc, requireAuth) {
  const base = structuredClone(doc);
  for (const [name, server] of Object.entries(base.mcpServers)) {
    const where = `${file} mcpServers.${name}`;
    // "public submission rejects nonempty server headers" (plugins/deploy/submission)
    if (server.headers && Object.keys(server.headers).length) fail(`${where}.headers must be empty for public submission`);
    const ext = server.extensions;
    if (!requireAuth) {
      if (ext !== undefined) fail(`${where}.extensions: Codex drops a server with extensions; put auth in ${submissionFile}`);
      continue;
    }
    delete server.extensions;
    const extra = Object.keys(ext ?? {}).filter((k) => k !== "com.openai");
    if (extra.length) fail(`${where}.extensions: unknown key(s) ${extra.join(", ")}`);
    const auth = ext?.["com.openai"]?.auth;
    if (!auth) { fail(`${where}.extensions["com.openai"].auth missing`); continue; }
    if (!AUTH_TYPES.includes(auth.type)) fail(`${where} auth.type ${auth.type} not one of ${AUTH_TYPES}`);
    for (const k of Object.keys(auth)) if (!AUTH_FIELDS.includes(k)) fail(`${where} auth.${k} is not a documented field`);
    if (auth.client) {
      const c = auth.client;
      if (!CLIENT_MODES.includes(c.mode)) fail(`${where} auth.client.mode ${c.mode} not one of ${CLIENT_MODES}`);
      // "the manifest rejects clientSecret"; "Don't include clientId or client
      // credentials in a dcr or cimd client object."
      if ("clientSecret" in c) fail(`${where} auth.client.clientSecret is rejected by OpenAI`);
      if (c.mode !== "provided" && Object.keys(c).some((k) => k !== "mode")) fail(`${where} auth.client: a ${c.mode} client takes only mode`);
      if (c.mode === "provided" && !c.clientId) fail(`${where} auth.client.clientId is required for a provided client`);
    }
  }
  return base;
}

await validate("plugin", join(PLUGIN_DIR, "plugin.json"));
await validate("mcp", mcpFile, checkServers(mcpFile, readJSON(mcpFile), false));
await validate("mcp", submissionFile, checkServers(submissionFile, readJSON(submissionFile), true));

const portable = readJSON(join(PLUGIN_DIR, "plugin.json"));
const claude = readJSON(join(PLUGIN_DIR, ".claude-plugin/plugin.json"));
if (portable.name !== claude.name) fail(`name: plugin.json ${portable.name} != .claude-plugin ${claude.name}`);
if (portable.version !== claude.version) fail(`version: plugin.json ${portable.version} != .claude-plugin ${claude.version}`);

// Both MCP configs must point at the same server, or Claude and OpenAI users
// silently talk to different backends.
const urls = (cfg) => Object.values(cfg.mcpServers).map((s) => s.url).sort().join(",");
const portableURLs = urls(readJSON(join(PLUGIN_DIR, "mcp.json")));
const claudeURLs = urls(readJSON(join(PLUGIN_DIR, ".mcp.json")));
if (portableURLs !== claudeURLs) fail(`MCP URLs differ: mcp.json [${portableURLs}] vs .mcp.json [${claudeURLs}]`);
const submissionURLs = urls(readJSON(submissionFile));
if (submissionURLs !== portableURLs) fail(`MCP URLs differ: ${submissionFile} [${submissionURLs}] vs mcp.json [${portableURLs}]`);

// OpenAI listing limits (developers.openai.com/apps-sdk/deploy/submission).
const ui = portable.extensions?.["com.openai"]?.interface;
if (!ui) {
  fail("plugin.json: extensions.com.openai.interface missing");
} else {
  for (const f of ["displayName", "shortDescription", "longDescription", "developerName", "category",
                   "websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL", "logo", "composerIcon"]) {
    if (!ui[f]) fail(`interface.${f} is required for submission`);
  }
  if (ui.displayName?.length > 30) fail(`interface.displayName > 30 chars`);
  if (ui.shortDescription?.length > 30) fail(`interface.shortDescription > 30 chars`);
  if (ui.longDescription?.length > 4000) fail(`interface.longDescription > 4000 chars`);
  for (const f of ["logo", "composerIcon"]) {
    if (ui[f] && !existsSync(join(PLUGIN_DIR, ui[f]))) fail(`interface.${f}: ${ui[f]} does not exist`);
    else if (ui[f]) checkIcon(`interface.${f}`, join(PLUGIN_DIR, ui[f]));
  }
  // "Up to three starter prompts, at most 128 characters each. Make them
  // unique and omit app @mentions." (developers.openai.com/plugins/deploy/submission)
  const prompts = ui.defaultPrompt ?? [];
  if (prompts.length > 3) fail(`interface.defaultPrompt: ${prompts.length} prompts, at most 3`);
  if (new Set(prompts).size !== prompts.length) fail(`interface.defaultPrompt: prompts must be unique`);
  for (const p of prompts) {
    if (p.length > 128) fail(`interface.defaultPrompt: "${p.slice(0, 40)}…" > 128 chars`);
    if (/@\w/.test(p)) fail(`interface.defaultPrompt: "${p.slice(0, 40)}…" has an @mention`);
  }
  // "#RRGGBB format, with at least 2:1 contrast against white"; the dark
  // variant, derived when absent, needs 2:1 against #212121.
  if (!/^#[0-9a-fA-F]{6}$/.test(ui.brandColor ?? "")) fail(`interface.brandColor: ${ui.brandColor} is not #RRGGBB`);
  else if (contrast(ui.brandColor, "#ffffff") < 2) fail(`interface.brandColor: ${ui.brandColor} has < 2:1 contrast against white`);
  if (ui.brandColorDark && contrast(ui.brandColorDark, "#212121") < 2) fail(`interface.brandColorDark: < 2:1 against #212121`);
}

// The ZIP-only review block (scripts/build-openai-submission.sh merges it):
// "Initial MCP app review requires exactly five positive and three negative cases."
const review = readJSON("openai-submission/review.json");
const pos = review.test_cases?.positive ?? [];
const neg = review.test_cases?.negative ?? [];
if (pos.length !== 5) fail(`openai-submission/review.json: ${pos.length} positive test cases, need exactly 5`);
if (neg.length !== 3) fail(`openai-submission/review.json: ${neg.length} negative test cases, need exactly 3`);
pos.forEach((c, i) => {
  for (const f of ["description", "prompt", "tools_triggered", "expected_behavior"]) {
    if (typeof c[f] !== "string" || !c[f]) fail(`review positive[${i}].${f} is required (string)`);
  }
});
neg.forEach((c, i) => {
  for (const f of ["description", "prompt", "expected_behavior"]) {
    if (typeof c[f] !== "string" || !c[f]) fail(`review negative[${i}].${f} is required (string)`);
  }
});
for (const c of [...pos, ...neg]) {
  for (const u of c.file_attachment_urls ?? []) if (!u.startsWith("https://")) fail(`review: attachment ${u} is not https`);
}
if (typeof review.commerce !== "boolean") fail(`openai-submission/review.json: commerce must be a boolean`);
for (const f of ["test_credentials", "reviewer_instructions"]) {
  if (f in review) fail(`openai-submission/review.json: ${f} is refused in the ZIP; enter it in the portal`);
}

// The Codex marketplace must point at the plugin directory we just validated.
const market = readJSON(".agents/plugins/marketplace.json");
const entry = market.plugins.find((p) => p.name === portable.name);
if (!entry) fail(`.agents/plugins/marketplace.json: no entry for ${portable.name}`);
else if (!existsSync(join(entry.source.path, "plugin.json"))) fail(`marketplace source.path ${entry.source.path} has no plugin.json`);

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
console.log(`✓ Agent Plugins manifests valid (${portable.name}@${portable.version}, MCP ${portableURLs})`);
