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

async function validate(kind, file) {
  const res = await fetch(SCHEMAS[kind]);
  if (!res.ok) throw new Error(`fetch ${SCHEMAS[kind]}: HTTP ${res.status}`);
  const check = ajv.compile(await res.json());
  if (!check(readJSON(file))) {
    for (const e of check.errors) fail(`${file}${e.instancePath} ${e.message}`);
  }
}

await validate("plugin", join(PLUGIN_DIR, "plugin.json"));
await validate("mcp", join(PLUGIN_DIR, "mcp.json"));

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
  }
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
